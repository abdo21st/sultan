import { expect, test, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test.describe.configure({ mode: 'serial', retries: 0 });

async function signIn(request: APIRequestContext, username: string, password: string) {
    const { csrfToken } = await (await request.get('/api/auth/csrf')).json();
    await request.post('/api/auth/callback/credentials', {
        form: { username, password, csrfToken, json: 'true' }, headers: { 'X-Auth-Return-Redirect': '1' },
    });
    const session = await (await request.get('/api/auth/session')).json();
    expect(session?.user?.id).toBeTruthy();
    return session;
}

async function signInAdmin(request: APIRequestContext) {
    test.skip(!process.env.E2E_ADMIN_USERNAME, 'Use the isolated E2E runner.');
    await signIn(request, process.env.E2E_ADMIN_USERNAME!, process.env.E2E_ADMIN_PASSWORD!);
}

test('initial password gate, browser change, session revocation and administrator reset', async ({ request, browser }) => {
    await signInAdmin(request);
    const username = `temporary_${randomUUID()}`;
    const initial = `I${randomUUID().slice(0, 5)}`;
    const replacement = `N${randomUUID().slice(0, 5)}`;
    expect((await request.post('/api/users', { data: { username, password: initial.slice(0, 5), displayName: 'Temporary security fixture', role: 'USER' } })).status()).toBe(400);
    const created = await request.post('/api/users', { data: { username, password: initial, displayName: 'Temporary security fixture', role: 'USER' } });
    expect(created.status()).toBe(200);
    const { id } = await created.json();
    const context = await browser.newContext({ baseURL: 'http://localhost:4317' });
    const other = await browser.newContext({ baseURL: 'http://localhost:4317' });
    try {
        const session = await signIn(context.request, username, initial);
        expect(session.user.mustChangePassword).toBe(true);
        await signIn(other.request, username, initial);
        expect((await context.request.get('/api/orders')).status()).toBe(403);
        expect((await context.request.put('/api/profile', { data: { displayName: 'Blocked' } })).status()).toBe(401);
        expect((await context.request.post(`/api/orders/${process.env.E2E_OWN_ORDER_ID}/shares`)).status()).toBe(401);
        expect((await context.request.patch('/api/profile', { data: { currentPassword: 'wrong-password', newPassword: replacement } })).status()).toBe(400);
        expect((await context.request.patch('/api/profile', { data: { currentPassword: initial, newPassword: initial } })).status()).toBe(400);
        expect((await context.request.patch('/api/profile', { data: { currentPassword: initial, newPassword: replacement.slice(0, 5) } })).status()).toBe(400);

        const page = await context.newPage();
        await page.goto('/orders/new');
        await expect(page).toHaveURL(/\/change-password$/);
        await expect(page.getByLabel('كلمة المرور الجديدة', { exact: true })).toHaveAttribute('minlength', '6');
        await expect(page.getByLabel('تأكيد كلمة المرور الجديدة', { exact: true })).toHaveAttribute('minlength', '6');
        await page.getByLabel('كلمة المرور الحالية', { exact: true }).fill(initial);
        await page.getByLabel('كلمة المرور الجديدة', { exact: true }).fill(replacement);
        await page.getByLabel('تأكيد كلمة المرور الجديدة', { exact: true }).fill(replacement);
        await page.getByRole('button', { name: 'حفظ كلمة المرور', exact: true }).click();
        await expect(page).toHaveURL(/\/login\?passwordChanged=1$/);
        expect((await (await other.request.get('/api/auth/session')).json())?.user).toBeUndefined();
        const redirected = await other.request.get('/profile', { maxRedirects: 0 });
        expect(redirected.headers().location).toContain('/login');
        expect((await signIn(context.request, username, replacement)).user.mustChangePassword).toBe(false);
        expect((await context.request.get('/api/orders')).status()).toBe(200);

        const reset = `R${randomUUID().slice(0, 5)}`;
        expect((await request.patch(`/api/users/${id}`, { data: { username, displayName: 'Temporary security fixture', role: 'USER', password: reset.slice(0, 5) } })).status()).toBe(400);
        expect((await (await context.request.get('/api/auth/session')).json())?.user?.id).toBe(id);
        expect((await request.patch(`/api/users/${id}`, { data: { username, displayName: 'Temporary security fixture', role: 'USER', password: reset } })).status()).toBe(200);
        expect((await (await context.request.get('/api/auth/session')).json())?.user).toBeUndefined();
        expect((await signIn(context.request, username, reset)).user.mustChangePassword).toBe(true);
    } finally {
        await context.close();
        await other.close();
        expect((await request.delete(`/api/users/${id}`)).status()).toBe(200);
    }
});

test('simultaneous password changes commit once and invalidate both previous sessions', async ({ request, browser }) => {
    await signInAdmin(request);
    const username = `race_${randomUUID()}`;
    const initial = randomUUID();
    const created = await request.post('/api/users', { data: { username, password: initial, displayName: 'Password race fixture', role: 'USER' } });
    expect(created.status()).toBe(200);
    const { id } = await created.json();
    const one = await browser.newContext({ baseURL: 'http://localhost:4317' });
    const two = await browser.newContext({ baseURL: 'http://localhost:4317' });
    try {
        await signIn(one.request, username, initial);
        await signIn(two.request, username, initial);
        const passwords = [randomUUID(), randomUUID()];
        const responses = await Promise.all([one, two].map((context, index) => context.request.patch('/api/profile', { data: { currentPassword: initial, newPassword: passwords[index] } })));
        expect(responses.filter(response => response.status() === 200)).toHaveLength(1);
        expect(responses.filter(response => [401, 409].includes(response.status()))).toHaveLength(1);
        for (const context of [one, two]) expect((await (await context.request.get('/api/auth/session')).json())?.user).toBeUndefined();
        const winner = responses.findIndex(response => response.status() === 200);
        expect((await signIn(one.request, username, passwords[winner])).user.mustChangePassword).toBe(false);
        const entries = (await (await request.get(`/api/audit?entityType=USER&entityId=${id}`)).json()).items;
        expect(entries.filter((entry: { action: string }) => entry.action === 'PASSWORD_CHANGED')).toHaveLength(1);
    } finally {
        await one.close(); await two.close();
        expect((await request.delete(`/api/users/${id}`)).status()).toBe(200);
    }
});

test('revoked shares stop serving both document and images, with scoped permissions and audit', async ({ request, browser }) => {
    await signInAdmin(request);
    const id = process.env.E2E_OWN_ORDER_ID!;
    const outsider = await browser.newContext({ baseURL: 'http://localhost:4317' });
    const staff = await browser.newContext({ baseURL: 'http://localhost:4317' });
    try {
        await signIn(staff.request, process.env.E2E_USER_USERNAME!, process.env.E2E_USER_PASSWORD!);
        expect((await staff.request.post(`/api/orders/${id}/shares`)).status()).toBe(404);
        expect((await staff.request.delete(`/api/orders/${id}/shares`, { data: { reason: 'Permission denial acceptance' } })).status()).toBe(404);
        await signIn(staff.request, process.env.E2E_MANAGER_USERNAME!, process.env.E2E_MANAGER_PASSWORD!);
        expect((await staff.request.post(`/api/orders/${process.env.E2E_FOREIGN_ORDER_ID}/shares`)).status()).toBe(404);
        expect((await staff.request.delete(`/api/orders/${process.env.E2E_FOREIGN_ORDER_ID}/shares`, { data: { reason: 'Cross facility denial acceptance' } })).status()).toBe(404);

        const issue = await request.post(`/api/orders/${id}/shares`);
        expect(issue.status()).toBe(200);
        const { path } = await issue.json();
        expect((await outsider.request.get(path)).status()).toBe(200);
        const token = new URL(path, 'http://localhost').searchParams.get('token')!;
        const imagePath = `/api/orders/${id}/images/0?token=${encodeURIComponent(token)}`;
        const image = await outsider.request.get(imagePath);
        expect(image.status()).toBe(200);
        expect((await request.delete(`/api/orders/${id}/shares`, { data: { reason: '' } })).status()).toBe(400);
        expect((await request.delete(`/api/orders/${id}/shares`, { data: { reason: 'Customer link revoked during isolated acceptance' } })).status()).toBe(200);
        expect((await outsider.request.get(path)).status()).toBe(404);
        expect((await outsider.request.get(imagePath, { headers: { 'If-None-Match': image.headers().etag } })).status()).toBe(404);
        const next = await (await request.post(`/api/orders/${id}/shares`)).json();
        expect(next.path).not.toBe(path);
        expect((await outsider.request.get(next.path)).status()).toBe(200);
        const entries = (await (await request.get(`/api/audit?entityType=ORDER&entityId=${id}&limit=100`)).json()).items;
        expect(entries.filter((entry: { action: string }) => entry.action === 'SHARE_LINK_ISSUED')).toHaveLength(2);
        expect(entries.filter((entry: { action: string }) => entry.action === 'SHARE_LINKS_REVOKED')).toHaveLength(1);
        expect(JSON.stringify(entries)).not.toContain(token);
    } finally { await outsider.close(); await staff.close(); }
});
