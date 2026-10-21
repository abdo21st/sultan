import { test, expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
test.describe.configure({ mode: 'serial', retries: 0 });
test.setTimeout(100_000);

async function sql(text: string, values: unknown[]) {
    const url = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
    const parsed = new URL(url);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) || !/^\/sultan_e2e_[a-z0-9_]+$/.test(parsed.pathname)) throw new Error('Use only the disposable E2E database.');
    const client = new Client({ connectionString: url }); await client.connect();
    try { return await client.query(text, values); } finally { await client.end(); }
}
async function login(request: APIRequestContext, outside = false) {
    test.skip(!process.env.E2E_STREAM_USERNAME, 'Use the disposable E2E runner.');
    const { csrfToken } = await (await request.get('/api/auth/csrf')).json();
    const key = outside ? 'E2E_STREAM_OUTSIDE_' : 'E2E_STREAM_';
    await request.post('/api/auth/callback/credentials', { form: { csrfToken, username: process.env[`${key}USERNAME`]!, password: process.env[`${key}PASSWORD`]!, json: 'true' }, headers: { 'X-Auth-Return-Redirect': '1' } });
    expect((await (await request.get('/api/auth/session')).json()).user?.role).toBe('MANAGER');
}
async function observe(context: BrowserContext) {
    await context.addInitScript(() => {
        const target = window as typeof window & { streamStates: number; streamMessages: string[]; lastStreamState?: { unreadCount: number } };
        target.streamStates = 0; target.streamMessages = [];
        const Native = window.EventSource;
        window.EventSource = class extends Native {
            constructor(url: string | URL, options?: EventSourceInit) {
                super(url, options);
                this.addEventListener('state', event => { target.streamStates++; target.lastStreamState = JSON.parse(event.data); });
                this.addEventListener('message', event => { target.streamMessages.push(...JSON.parse(event.data).map((item: { id: string }) => item.id)); });
            }
        };
    });
}
async function ready(page: Page) {
    await page.goto('/');
    await page.waitForFunction(() => (window as unknown as { streamStates: number }).streamStates > 0);
}
async function insert(userId: string, title: string) {
    const id = randomUUID();
    await sql('INSERT INTO "Notification" (id,"userId",title,message,link,read,"createdAt") VALUES ($1,$2,$3,$4,$5,false,clock_timestamp())', [id, userId, title, 'Synthetic SSE acceptance', `/orders/${process.env.E2E_OWN_ORDER_ID}`]);
    return id;
}

test.describe('shared notification stream @notification_stream', () => {
    test('two windows receive only their user, share read state, and do not poll HTTP every thirty seconds', async ({ browser }) => {
        const own = await browser.newContext(); const other = await browser.newContext();
        try {
            await observe(own); await observe(other); await login(own.request); await login(other.request, true);
            const first = await own.newPage(); const second = await own.newPage(); const outsider = await other.newPage();
            let httpPolls = 0;
            for (const page of [first, second, outsider]) page.on('request', request => { if (new URL(request.url()).pathname === '/api/notifications' && request.method() === 'GET') httpPolls++; });
            await ready(first); await ready(second); await ready(outsider);
            const title = `Shared notification ${randomUUID()}`;
            const id = await insert(process.env.E2E_STREAM_USER_ID!, title);
            for (const page of [first, second]) await expect(page.getByText(title, { exact: true }).first()).toBeVisible({ timeout: 25_000 });
            await expect(outsider.getByText(title, { exact: true })).toHaveCount(0);
            await first.getByRole('button', { name: 'التنبيهات', exact: true }).click();
            await first.locator('p').getByText(title, { exact: true }).click();
            await expect.poll(async () => second.evaluate(() => (window as unknown as { lastStreamState?: { unreadCount: number } }).lastStreamState?.unreadCount), { timeout: 25_000 }).toBe(0);
            await expect(second.getByRole('button', { name: 'التنبيهات', exact: true }).locator('span')).toHaveCount(0);
            const before = httpPolls;
            await first.waitForTimeout(31_000); // Exceeds the removed 30 second polling interval.
            expect(httpPolls).toBe(before);
            for (const page of [first, second]) expect(await page.evaluate(id => (window as unknown as { streamMessages: string[] }).streamMessages.filter(value => value === id).length, id)).toBe(1);
        } finally { await own.close(); await other.close(); }
    });

    test('a revoked live session closes without exposing its next message while another user stays connected', async ({ browser }) => {
        const own = await browser.newContext(); const other = await browser.newContext();
        try {
            await observe(own); await observe(other); await login(own.request); await login(other.request, true);
            const page = await own.newPage(); const outsider = await other.newPage(); await ready(page); await ready(outsider);
            await page.evaluate(() => {
                const target = window as unknown as { rawReady: boolean; rawClosed: boolean; rawBody: string };
                target.rawReady = false; target.rawClosed = false; target.rawBody = '';
                void (async () => {
                    const response = await fetch('/api/notifications/stream'); const reader = response.body!.getReader(); const decoder = new TextDecoder();
                    for (;;) { const result = await reader.read(); if (result.done) break; target.rawBody += decoder.decode(result.value); if (target.rawBody.includes(': keep-alive')) target.rawReady = true; }
                    target.rawClosed = true;
                })();
            });
            await page.waitForFunction(() => (window as unknown as { rawReady: boolean }).rawReady);
            await sql('UPDATE "User" SET "sessionVersion"="sessionVersion"+1 WHERE id=$1', [process.env.E2E_STREAM_USER_ID]);
            const hidden = await insert(process.env.E2E_STREAM_USER_ID!, `Revoked ${randomUUID()}`);
            await expect.poll(() => page.evaluate(() => (window as unknown as { rawClosed: boolean }).rawClosed), { timeout: 25_000 }).toBe(true);
            expect(await page.evaluate(id => (window as unknown as { rawBody: string }).rawBody.includes(id), hidden)).toBe(false);
            expect((await own.request.get('/api/notifications')).status()).toBe(401);
            const title = `Other user's notification ${randomUUID()}`;
            await insert(process.env.E2E_STREAM_OUTSIDE_USER_ID!, title);
            await expect(outsider.getByText(title, { exact: true }).first()).toBeVisible({ timeout: 25_000 });
            await expect(page.getByText(title, { exact: true })).toHaveCount(0);
        } finally { await own.close(); await other.close(); }
    });

    test('the updated browser still handles the previous server stream format', async ({ page }) => {
        await login(page.request);
        const title = `Legacy stream ${randomUUID()}`;
        const id = await insert(process.env.E2E_STREAM_USER_ID!, title);
        const legacy = [{ id, title, message: 'Synthetic legacy event', link: `/orders/${process.env.E2E_OWN_ORDER_ID}`, createdAt: new Date().toISOString() }];
        await page.route('**/api/notifications/stream', route => route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }, body: `: connected\n\ndata: ${JSON.stringify(legacy)}\n\n` }));
        await page.goto('/');
        await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
        await page.getByRole('button', { name: 'التنبيهات', exact: true }).click();
        await expect(page.locator('p').getByText(title, { exact: true })).toBeVisible();
    });
});
