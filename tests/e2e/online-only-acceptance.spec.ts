import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

test.describe.configure({ mode: 'serial', retries: 0 });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=', 'base64');
async function login(request: APIRequestContext, admin = false) {
    test.skip(!process.env.E2E_MANAGER_USERNAME, 'Use the disposable E2E runner.');
    const { csrfToken } = await (await request.get('/api/auth/csrf')).json();
    await request.post('/api/auth/callback/credentials', { form: { csrfToken, username: process.env[admin ? 'E2E_ADMIN_USERNAME' : 'E2E_MANAGER_USERNAME']!, password: process.env[admin ? 'E2E_ADMIN_PASSWORD' : 'E2E_MANAGER_PASSWORD']!, json: 'true' }, headers: { 'X-Auth-Return-Redirect': '1' } });
    expect((await (await request.get('/api/auth/session')).json()).user?.role).toBe(admin ? 'ADMIN' : 'MANAGER');
}
async function fill(page: Page, name: string) {
    await page.goto('/orders/new');
    await expect(page.locator('select[name="factoryId"] option').nth(1)).toBeAttached();
    await page.locator('input[name="customerName"]').fill(name);
    await page.locator('input[name="customerPhone"]').fill('0910000009');
    await page.locator('textarea[name="description"]').fill('Synthetic online-only image acceptance');
    await page.locator('input[name="totalAmount"]').fill('100');
    await page.locator('input[name="dueDate"]').fill(new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10));
    await page.locator('select[name="factoryId"]').selectOption({ index: 1 });
    await page.locator('input[type="file"]').setInputFiles({ name: 'online.png', mimeType: 'image/png', buffer: png });
}
async function saved(request: APIRequestContext, name: string) {
    const response = await request.get('/api/orders?limit=100');
    expect(response.status()).toBe(200);
    return (await response.json() as { id: string; customerName: string; paidAmount: number; images: string[] }[]).filter(row => row.customerName === name);
}
async function checkSaved(request: APIRequestContext, name: string) {
    const rows = await saved(request, name);
    expect(rows).toHaveLength(1); expect(rows[0].images).toHaveLength(1); expect(rows[0].paidAmount).toBe(0);
    const image = await request.get(`/api/orders/${rows[0].id}/images/0`);
    expect(image.status()).toBe(200); expect((await image.body()).equals(png)).toBe(true);
}
async function localDatabases(page: Page) {
    return page.evaluate(async () => (await indexedDB.databases()).map(db => db.name).filter(name => name?.startsWith('Sultan')));
}
const submit = (page: Page) => page.getByRole('button', { name: 'إنشاء الطلب', exact: true });
const failedSave = (page: Page) => page.getByText('تعذر تأكيد الحفظ من الخادم. أعد المحاولة عند عودة الاتصال.', { exact: true });

test.describe('online-only acceptance @online_only', () => {
    test('disconnect blocks the form and reconnect requires an explicit save with its image', async ({ page }) => {
        await login(page.request);
        const name = `E2E Online Only Reconnect ${randomUUID()}`;
        await fill(page, name);
        let posts = 0;
        page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/orders') posts++; });
        await page.context().setOffline(true);
        await expect(page.getByRole('heading', { name: 'يلزم اتصال بالإنترنت' })).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeDisabled();
        await page.locator('form').evaluate(form => (form as HTMLFormElement).requestSubmit());
        expect(posts).toBe(0); expect(await localDatabases(page)).toEqual([]);
        await page.context().setOffline(false);
        await expect(submit(page)).toBeEnabled();
        expect(await saved(page.request, name)).toHaveLength(0); expect(posts).toBe(0);
        await submit(page).click(); await expect(page).toHaveURL(/\/$/);
        await checkSaved(page.request, name); expect(posts).toBe(1);
    });

    test('a failed request leaves no durable draft and a page reload clears the unsent form', async ({ page }) => {
        await login(page.request);
        const name = `E2E Online Only Request Failure ${randomUUID()}`;
        await fill(page, name);
        await page.route('**/api/orders', route => route.request().method() === 'POST' ? route.abort('failed') : route.continue());
        await submit(page).click(); await expect(failedSave(page)).toBeVisible();
        await expect(page.locator('input[name="customerName"]')).toHaveValue(name);
        expect(await localDatabases(page)).toEqual([]); expect(await saved(page.request, name)).toHaveLength(0);
        await page.unroute('**/api/orders'); await page.reload();
        await expect(page.locator('input[name="customerName"]')).toHaveValue('');
        expect(await localDatabases(page)).toEqual([]);
        await fill(page, name); await submit(page).click(); await expect(page).toHaveURL(/\/$/);
        await checkSaved(page.request, name);
    });

    test('manual retry after a lost success response creates one order and one image', async ({ page }) => {
        await login(page.request);
        const name = `E2E Online Only Lost Response ${randomUUID()}`;
        await fill(page, name);
        let committed = false;
        await page.route('**/api/orders', async route => {
            if (route.request().method() !== 'POST') { await route.continue(); return; }
            expect((await route.fetch()).status()).toBe(200); committed = true; await route.abort('failed');
        });
        await submit(page).click(); await expect(failedSave(page)).toBeVisible(); expect(committed).toBe(true);
        await checkSaved(page.request, name); expect(await localDatabases(page)).toEqual([]);
        await page.unroute('**/api/orders'); await submit(page).click(); await expect(page).toHaveURL(/\/$/);
        await checkSaved(page.request, name);
    });

    test('an installed legacy worker is retired while old unsent data remains intact and is never submitted', async ({ page }) => {
        await login(page.request); await page.goto('/orders/new');
        await expect(submit(page)).toBeEnabled();
        const name = `Legacy Unsent ${randomUUID()}`;
        await page.evaluate(({ name, bytes }) => new Promise<void>((resolve, reject) => {
            const open = indexedDB.open('SultanAppDB', 20);
            open.onupgradeneeded = () => open.result.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
                const db = open.result, tx = db.transaction('orders', 'readwrite');
                tx.objectStore('orders').add({ customerName: name, status: 'pending', idempotencyKey: crypto.randomUUID(), images: [new Blob([new Uint8Array(bytes)], { type: 'image/png' })] });
                tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); };
            };
        }), { name, bytes: Array.from(png) });
        // Install a harmless old worker in the disposable standalone test server only.
        const workerPath = path.resolve('.next/standalone/public/sw.js');
        const retirementWorker = await readFile(workerPath);
        try {
            await writeFile(workerPath, "self.addEventListener('install', event => event.waitUntil(self.skipWaiting())); self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));");
            await page.evaluate(async () => {
                const cache = await caches.open('sultan-offline-legacy-acceptance'); await cache.put('/legacy-probe', new Response('old shell'));
                const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
                await navigator.serviceWorker.ready;
                if (registration.active?.state !== 'activated') await new Promise<void>(resolve => registration.active?.addEventListener('statechange', () => resolve(), { once: true }));
            });
        } finally { await writeFile(workerPath, retirementWorker); }
        await page.reload(); await expect(submit(page)).toBeEnabled();
        await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
        expect(await page.evaluate(async () => (await caches.keys()).filter(name => name.startsWith('sultan-offline-')))).toEqual([]);
        const preserved = await page.evaluate(() => new Promise<{ version: number; count: number; bytes: number[] }>((resolve, reject) => {
            const open = indexedDB.open('SultanAppDB', 20); open.onerror = () => reject(open.error);
            open.onsuccess = () => {
                const db = open.result, request = db.transaction('orders', 'readonly').objectStore('orders').getAll();
                request.onerror = () => { db.close(); reject(request.error); };
                request.onsuccess = async () => { const version = db.version; db.close(); resolve({ version, count: request.result.length, bytes: Array.from(new Uint8Array(await (request.result[0].images[0] as Blob).arrayBuffer())) }); };
            };
        }));
        expect(preserved.version).toBe(20); expect(preserved.count).toBe(1); expect(Buffer.from(preserved.bytes).equals(png)).toBe(true);
        expect(await saved(page.request, name)).toHaveLength(0);
        await login(page.request, true); await page.reload();
        await expect(page.getByRole('status')).toContainText('توجد 1 مسودات من النسخة السابقة');
        expect(await saved(page.request, name)).toHaveLength(0);
    });

    test('a forbidden facilities request cannot fall back to an old local snapshot', async ({ page }) => {
        await login(page.request); await page.goto('/orders/new'); await expect(submit(page)).toBeEnabled();
        await page.evaluate(() => new Promise<void>((resolve, reject) => {
            const open = indexedDB.open('SultanFacilityCache', 10);
            open.onupgradeneeded = () => open.result.createObjectStore('facilityCache', { keyPath: 'key' });
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
                const db = open.result, tx = db.transaction('facilityCache', 'readwrite');
                tx.objectStore('facilityCache').put({ key: 'current', facilities: [{ id: 'forbidden-factory', name: 'Old cached factory', type: 'FACTORY' }] });
                tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); };
            };
        }));
        await page.route('**/api/facilities', route => route.fulfill({ status: 403, json: { error: 'Forbidden' } }));
        await page.reload();
        await expect(page.getByText('يلزم تسجيل الدخول بصلاحية عرض المنشآت.', { exact: true })).toBeVisible();
        await expect(page.locator('select[name="factoryId"] option')).toHaveCount(1); await expect(submit(page)).toBeDisabled();
        await expect.poll(() => localDatabases(page)).toEqual([]);
    });

    test('the mobile viewport blocks offline use and permits one explicit online image save', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 }); await login(page.request);
        const name = `E2E Online Only Mobile Viewport ${randomUUID()}`;
        await fill(page, name); await page.context().setOffline(true);
        await expect(page.getByRole('heading', { name: 'يلزم اتصال بالإنترنت' })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: test.info().outputPath('online-required-mobile-viewport.png') });
        await page.context().setOffline(false); await expect(submit(page)).toBeEnabled();
        expect(await saved(page.request, name)).toHaveLength(0);
        await submit(page).click(); await expect(page).toHaveURL(/\/$/); await checkSaved(page.request, name);
        expect(await localDatabases(page)).toEqual([]);
    });
});
