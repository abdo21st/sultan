import { chromium, expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test.describe.configure({ mode: 'serial', retries: 0 });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=', 'base64');
type QueuedImage = { idempotencyKey: string; status: string; attempts: number; imageCount: number; bytes: number[]; lastStatus?: number };
async function login(request: APIRequestContext) {
    test.skip(!process.env.E2E_MANAGER_USERNAME, 'Use the disposable E2E runner.');
    const { csrfToken } = await (await request.get('/api/auth/csrf')).json();
    await request.post('/api/auth/callback/credentials', { form: { csrfToken, username: process.env.E2E_MANAGER_USERNAME!, password: process.env.E2E_MANAGER_PASSWORD!, json: 'true' }, headers: { 'X-Auth-Return-Redirect': '1' } });
    expect((await (await request.get('/api/auth/session')).json()).user?.role).toBe('MANAGER');
}
async function queue(page: Page) {
    return page.evaluate(() => new Promise<QueuedImage[]>((resolve, reject) => {
        const open = indexedDB.open('SultanAppDB');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
            const database = open.result;
            const request = database.transaction('orders', 'readonly').objectStore('orders').getAll();
            request.onerror = () => { database.close(); reject(request.error); };
            request.onsuccess = async () => {
                try {
                    const rows = await Promise.all(request.result.map(async row => ({ idempotencyKey: row.idempotencyKey as string, status: row.status as string, attempts: row.attempts as number, imageCount: row.images.length as number, bytes: Array.from(new Uint8Array(await (row.images[0] as Blob).arrayBuffer())), lastStatus: row.lastStatus as number | undefined })));
                    resolve(rows);
                } catch (error) { reject(error); }
                finally { database.close(); }
            };
        };
    }));
}
async function saveOffline(page: Page, name: string) {
    await page.goto('/orders/new');
    await expect(page.getByRole('heading', { name: 'إنشاء طلب جديد' })).toBeVisible();
    await expect(page.locator('select[name="factoryId"] option').nth(1)).toBeAttached();
    await page.waitForFunction(() => new Promise<boolean>((resolve) => {
        const open = indexedDB.open('SultanFacilityCache');
        open.onerror = () => resolve(false);
        open.onsuccess = () => {
            const database = open.result;
            if (!database.objectStoreNames.contains('facilityCache')) { database.close(); resolve(false); return; }
            const request = database.transaction('facilityCache', 'readonly').objectStore('facilityCache').get('current');
            request.onsuccess = () => { database.close(); resolve(Boolean(request.result)); };
            request.onerror = () => { database.close(); resolve(false); };
        };
    }));
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await page.context().setOffline(true);
    await page.locator('input[name="customerName"]').fill(name);
    await page.locator('input[name="customerPhone"]').fill('0910000009');
    await page.locator('textarea[name="description"]').fill('Synthetic offline image acceptance');
    await page.locator('input[name="totalAmount"]').fill('100');
    await page.locator('input[name="dueDate"]').fill(new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10));
    await page.locator('select[name="factoryId"]').selectOption({ index: 1 });
    await page.locator('input[type="file"]').setInputFiles({ name: 'offline.png', mimeType: 'image/png', buffer: png });
    await page.getByRole('button', { name: 'إنشاء الطلب' }).click();
    await expect(page.getByRole('status')).toContainText('تم حفظ الطلب محليًا');
    await expect.poll(async () => (await queue(page)).length).toBe(1);
    const rows = await queue(page);
    expect(rows[0].imageCount).toBe(1);
    expect(Buffer.from(rows[0].bytes).equals(png)).toBe(true);
    return rows[0].idempotencyKey;
}
async function checkSaved(request: APIRequestContext, name: string, key: string) {
    const response = await request.get('/api/orders?limit=100');
    expect(response.status()).toBe(200);
    const rows = (await response.json() as { id: string; customerName: string; paidAmount: number; images: string[] }[]).filter(row => row.customerName === name);
    expect(rows).toHaveLength(1);
    expect(rows[0].images).toHaveLength(1);
    expect(rows[0].paidAmount).toBe(0);
    const image = await request.get(`/api/orders/${rows[0].id}/images/0`);
    expect(image.status()).toBe(200); expect((await image.body()).equals(png)).toBe(true);
    const order = await (await request.get(`/api/orders/${rows[0].id}`)).json();
    expect(order.images).toHaveLength(1);
    // The runner independently checks the durable key, ledger, image set and audit counts.
    return { id: rows[0].id, key };
}

test.describe('offline image acceptance @offline_images', () => {
    test('the image survives a complete browser restart and synchronizes once', async () => {
        test.skip(!process.env.E2E_MANAGER_USERNAME, 'Use the disposable E2E runner.');
        const profile = await mkdtemp(path.join(tmpdir(), 'sultan-offline-profile-'));
        let context: BrowserContext | undefined;
        const options = { headless: true, baseURL: 'http://localhost:4317', ...(process.env.E2E_CHROME_PATH ? { executablePath: process.env.E2E_CHROME_PATH } : {}) };
        const name = `E2E Offline Image Restart ${randomUUID()}`;
        try {
            context = await chromium.launchPersistentContext(profile, options);
            await login(context.request);
            const page = await context.newPage();
            const key = await saveOffline(page, name);
            await page.evaluate(() => navigator.serviceWorker.ready);
            await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
            await context.close(); context = undefined;
            context = await chromium.launchPersistentContext(profile, options);
            await context.setOffline(true);
            const reopened = await context.newPage();
            await reopened.goto('/orders/new');
            await expect(reopened.getByRole('heading', { name: 'أنت غير متصل بالإنترنت' })).toBeVisible();
            const preserved = await queue(reopened);
            expect(preserved[0].idempotencyKey).toBe(key);
            expect(Buffer.from(preserved[0].bytes).equals(png)).toBe(true);
            await context.setOffline(false);
            await expect(reopened.getByRole('heading', { name: 'إنشاء طلب جديد' })).toBeVisible();
            await expect.poll(async () => (await queue(reopened)).length, { timeout: 20_000 }).toBe(0);
            await checkSaved(context.request, name, key);
        } finally {
            await context?.close();
            const absolute = await realpath(profile);
            if (path.dirname(absolute) !== await realpath(tmpdir()) || !path.basename(absolute).startsWith('sultan-offline-profile-')) throw new Error('Unsafe disposable browser profile cleanup path.');
            await rm(absolute, { recursive: true, force: true });
        }
    });

    test('a failed image upload remains visible and retry preserves the image and key', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await login(page.request);
        const name = `E2E Offline Image Failure ${randomUUID()}`;
        const key = await saveOffline(page, name);
        await page.route('**/api/orders', async route => route.request().method() === 'POST'
            ? route.fulfill({ status: 500, json: { error: 'تعذر رفع صورة الاختبار، حاول مجدداً' } }) : route.continue());
        await page.context().setOffline(false);
        await expect.poll(async () => (await queue(page))[0]?.status).toBe('failed');
        await expect(page.getByText('تعذر رفع صورة الاختبار، حاول مجدداً', { exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.route('**/api/facilities', route => route.abort('failed'));
        await page.reload();
        await expect(page.getByText('تُعرض آخر قائمة منشآت محفوظة لهذا الحساب. ستُراجع الصلاحيات عند الإرسال.', { exact: true })).toBeVisible();
        const cachedShape = await page.evaluate(() => new Promise<{ keys: string[]; fields: string[][]; scope: string }>((resolve, reject) => {
            const open = indexedDB.open('SultanFacilityCache');
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
                const database = open.result;
                const request = database.transaction('facilityCache', 'readonly').objectStore('facilityCache').get('current');
                request.onsuccess = () => { database.close(); resolve({ keys: Object.keys(request.result).sort(), fields: request.result.facilities.map((facility: object) => Object.keys(facility).sort()), scope: request.result.scope }); };
                request.onerror = () => { database.close(); reject(request.error); };
            };
        }));
        expect(cachedShape.keys).toEqual(['facilities', 'key', 'scope', 'updatedAt']);
        expect(cachedShape.fields.every(fields => fields.join(',') === 'id,name,type')).toBe(true);
        expect(cachedShape.scope).toMatch(/^[a-f0-9]{64}$/);
        await expect(page.getByText('تعذر رفع صورة الاختبار، حاول مجدداً', { exact: true })).toBeVisible();
        await page.screenshot({ path: test.info().outputPath('persistent-upload-failure.png') });
        expect((await queue(page))[0].idempotencyKey).toBe(key);
        expect(Buffer.from((await queue(page))[0].bytes).equals(png)).toBe(true);
        await page.unroute('**/api/orders');
        await page.getByRole('button', { name: 'إعادة المحاولة', exact: true }).click();
        await expect.poll(async () => (await queue(page)).length).toBe(0);
        await checkSaved(page.request, name, key);
    });

    test('an expired server session preserves the image and prompts reauthentication', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await login(page.request);
        const name = `E2E Offline Image Session ${randomUUID()}`;
        const key = await saveOffline(page, name);
        const staleSession = await (await page.request.get('/api/auth/session')).json();
        await page.context().route('**/api/auth/session', route => route.fulfill({ status: 200, json: staleSession }));
        await page.context().clearCookies();
        await page.context().setOffline(false);
        await expect.poll(async () => (await queue(page))[0]?.status).toBe('failed');
        await expect(page.getByText('انتهت جلسة الدخول. طلباتك وصورها ما زالت محفوظة على هذا الجهاز.', { exact: true })).toBeVisible();
        await expect(page.getByRole('link', { name: 'تسجيل الدخول لمتابعة المزامنة' })).toBeVisible();
        expect((await queue(page))[0].lastStatus).toBe(401);
        expect(Buffer.from((await queue(page))[0].bytes).equals(png)).toBe(true);
        await page.context().unroute('**/api/auth/session');
        await page.reload();
        await expect(page.getByRole('link', { name: 'تسجيل الدخول لمتابعة المزامنة' })).toBeVisible();
        await page.screenshot({ path: test.info().outputPath('expired-session-preserves-queue.png') });
        await login(page.request);
        await page.reload();
        await page.getByRole('button', { name: 'إعادة المحاولة', exact: true }).click();
        await expect.poll(async () => (await queue(page)).length).toBe(0);
        await checkSaved(page.request, name, key);
    });

    test('a lost success response retries the same image without a second order', async ({ page }) => {
        await login(page.request);
        const name = `E2E Offline Image Lost Response ${randomUUID()}`;
        const key = await saveOffline(page, name);
        let committedResponseLost = false;
        await page.route('**/api/orders', async route => {
            if (route.request().method() !== 'POST') { await route.continue(); return; }
            const response = await route.fetch();
            expect(response.status()).toBe(200);
            committedResponseLost = true;
            await route.abort('failed');
        });
        await page.context().setOffline(false);
        await expect.poll(() => committedResponseLost).toBe(true);
        await expect.poll(async () => (await queue(page))[0]?.status).toBe('failed');
        await page.unroute('**/api/orders');
        await page.getByRole('button', { name: 'إعادة المحاولة', exact: true }).click();
        await expect.poll(async () => (await queue(page)).length).toBe(0);
        await checkSaved(page.request, name, key);
    });

    test('facility fallback rejects expired, differently scoped, and forbidden snapshots', async ({ page }) => {
        await login(page.request);
        await page.goto('/orders/new');
        await expect(page.locator('select[name="factoryId"] option').nth(1)).toBeAttached();
        const snapshot = await page.evaluate(() => new Promise<object>((resolve, reject) => {
            const open = indexedDB.open('SultanFacilityCache');
            open.onsuccess = () => {
                const database = open.result;
                const request = database.transaction('facilityCache', 'readonly').objectStore('facilityCache').get('current');
                request.onsuccess = () => { database.close(); resolve(request.result); };
                request.onerror = () => { database.close(); reject(request.error); };
            };
            open.onerror = () => reject(open.error);
        }));
        expect(snapshot).toBeTruthy();
        async function replaceSnapshot(change: object) {
            await page.evaluate(({ original, change }) => new Promise<void>((resolve, reject) => {
                const open = indexedDB.open('SultanFacilityCache');
                open.onsuccess = () => {
                    const database = open.result;
                    const transaction = database.transaction('facilityCache', 'readwrite');
                    transaction.objectStore('facilityCache').put({ ...original, ...change });
                    transaction.oncomplete = () => { database.close(); resolve(); };
                    transaction.onerror = () => { database.close(); reject(transaction.error); };
                };
                open.onerror = () => reject(open.error);
            }), { original: snapshot, change });
        }
        await page.route('**/api/facilities', route => route.abort('failed'));
        for (const change of [{ updatedAt: Date.now() - 25 * 60 * 60 * 1000 }, { scope: '0'.repeat(64) }]) {
            await replaceSnapshot(change);
            await page.reload();
            await expect(page.getByText('تعذر تحميل المنشآت. أعد الاتصال لفتح نموذج الطلب.')).toBeVisible();
            await expect(page.locator('select[name="factoryId"] option')).toHaveCount(1);
        }
        await replaceSnapshot({ updatedAt: Date.now() });
        await page.unroute('**/api/facilities');
        await page.route('**/api/facilities', route => route.fulfill({ status: 403, json: { error: 'Forbidden' } }));
        await page.reload();
        await expect(page.getByText('يلزم تسجيل الدخول بصلاحية عرض المنشآت.')).toBeVisible();
        await expect(page.locator('select[name="factoryId"] option')).toHaveCount(1);
    });

    test('an existing saved image remains readable by the previous queue client', async ({ page }) => {
        await login(page.request);
        await page.goto('/offline.html');
        const name = `E2E Offline Image Compatible Client ${randomUUID()}`;
        const key = randomUUID();
        await page.evaluate(({ name, key, bytes, factoryId, shopId }) => new Promise<void>((resolve, reject) => {
            const open = indexedDB.open('SultanAppDB', 20); // Dexie version 2 uses native IndexedDB version 20.
            open.onupgradeneeded = () => {
                const store = open.result.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
                for (const field of ['status', 'createdAt', 'nextAttemptAt']) store.createIndex(field, field);
            };
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
                const database = open.result;
                const transaction = database.transaction('orders', 'readwrite');
                transaction.objectStore('orders').add({ customerName: name, customerPhone: '0910000009', description: 'Synthetic previous local queue', totalAmount: '100', paidAmount: '0', dueDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10), factoryId, shopId, images: [new Blob([new Uint8Array(bytes)], { type: 'image/png' })], status: 'failed', idempotencyKey: key, attempts: 1, nextAttemptAt: Number.MAX_SAFE_INTEGER, lastError: 'انقطعت المزامنة قبل اكتمالها', createdAt: Date.now() });
                transaction.oncomplete = () => { database.close(); resolve(); };
                transaction.onerror = () => { database.close(); reject(transaction.error); };
            };
        }), { name, key, bytes: Array.from(png), factoryId: process.env.E2E_FACTORY_ID!, shopId: process.env.E2E_SHOP_ID! });
        await page.goto('/orders/new');
        await expect(page.getByRole('button', { name: 'إعادة المحاولة', exact: true })).toBeVisible();
        expect((await queue(page))[0].idempotencyKey).toBe(key);
        expect(Buffer.from((await queue(page))[0].bytes).equals(png)).toBe(true);
        const previousClientQueue = await page.evaluate(() => new Promise<{ opened: boolean; version?: number; error?: string }>(resolve => {
            const open = indexedDB.open('SultanAppDB', 20);
            open.onerror = () => resolve({ opened: false, error: open.error?.name });
            open.onsuccess = () => { const version = open.result.version; open.result.close(); resolve({ opened: true, version }); };
        }));
        expect(previousClientQueue).toEqual({ opened: true, version: 20 });
        await page.getByRole('button', { name: 'إعادة المحاولة', exact: true }).click();
        await expect.poll(async () => (await queue(page)).length).toBe(0);
        await checkSaved(page.request, name, key);
    });
});
