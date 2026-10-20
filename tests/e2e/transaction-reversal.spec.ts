import { expect, test, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test.describe.configure({ mode: 'serial', retries: 0 });
test.describe('financial corrections @reversal', () => {
    const reason = 'Isolated acceptance correction of a mistaken entry';
    async function login(request: APIRequestContext, role = 'ADMIN') {
        test.skip(!process.env.E2E_ADMIN_USERNAME, 'Use the isolated E2E runner.');
        const { csrfToken } = await (await request.get('/api/auth/csrf')).json();
        await request.post('/api/auth/callback/credentials', {
            form: { csrfToken, username: process.env[`E2E_${role}_USERNAME`]!, password: process.env[`E2E_${role}_PASSWORD`]!, json: 'true' },
            headers: { 'X-Auth-Return-Redirect': '1' },
        });
        expect((await (await request.get('/api/auth/session')).json()).user?.id).toBeTruthy();
    }
    async function entries(request: APIRequestContext) {
        const response = await request.get('/api/transactions?limit=100');
        expect(response.status()).toBe(200);
        return await response.json() as { id: string; orderId: string | null; amount: number; type: string; facilityId: string | null; reversalOfId: string | null; reversalReason: string | null; idempotencyKey: string | null; reversedBy: { id: string } | null; description: string | null }[];
    }
    async function paidOrder(request: APIRequestContext, paid = 30, total = 100) {
        const response = await request.post('/api/orders', { multipart: {
            clientRequestId: randomUUID(), customerName: `Reversal fixture ${randomUUID()}`, customerPhone: '0910000007', description: 'Synthetic reversal fixture',
            dueDate: new Date(Date.now() + 86400000 * 8).toISOString(), totalAmount: String(total), paidAmount: String(paid),
            factoryId: process.env.E2E_FACTORY_ID!, shopId: process.env.E2E_SHOP_ID!,
        } });
        expect(response.status()).toBe(200);
        const order = await response.json();
        const original = (await entries(request)).find(entry => entry.orderId === order.id && entry.amount > 0)!;
        expect(original).toBeTruthy();
        return { order, original };
    }
    function reverse(request: APIRequestContext, id: string, key: string = randomUUID(), note = reason) {
        return request.post(`/api/transactions/${id}/reverse`, { data: { reason: note, idempotencyKey: key } });
    }

    test('an expense reversal is visible in the interface and reconciles cash and reports', async ({ request, page }) => {
        await login(request);
        const before = await (await request.get('/api/finance/stats')).json();
        await login(page.request, 'MANAGER');
        const description = `Expense correction ${randomUUID()}`;
        const created = await page.request.post('/api/transactions', { data: { type: 'EXPENSE', amount: 13.01, category: 'OTHER', description } });
        expect(created.status()).toBe(200);
        const original = await created.json();
        await login(page.request);
        await page.goto('/transactions');
        const row = page.getByText(description, { exact: true }).locator('../..');
        await row.getByRole('button', { name: 'عكس الحركة' }).click();
        await page.getByLabel('سبب التصحيح').fill(reason);
        await page.getByRole('button', { name: 'تأكيد القيد العكسي' }).click();
        await expect(page.getByRole('dialog')).toBeHidden();
        await expect(page.getByText('عُكست هذه الحركة مع حفظ الأصل', { exact: true })).toBeVisible();
        const rows = await entries(request);
        const reversal = rows.find(entry => entry.reversalOfId === original.id)!;
        expect(reversal.amount).toBe(-13.01); expect(reversal.type).toBe('EXPENSE');
        expect(reversal.facilityId).toBe(original.facilityId); expect(reversal.reversalReason).toBe(reason);
        expect(rows.find(entry => entry.id === original.id)?.amount).toBe(13.01);
        const after = await (await request.get('/api/finance/stats')).json();
        expect(after).toEqual(before);
        const report = await (await request.get('/api/admin/reports?type=financial&limit=100')).json();
        expect(report.details.find((entry: { id: string }) => entry.id === reversal.id)).toMatchObject({ amount: -13.01, reversalOfId: original.id, reversalReason: reason });
        expect((await reverse(request, reversal.id)).status()).toBe(409);
    });

    test('reversal permission and facility scope apply to original entries and idempotency replays', async ({ request, browser }) => {
        await login(request);
        const rows = await entries(request);
        const own = rows.find(entry => entry.orderId === process.env.E2E_OWN_ORDER_ID)!;
        const foreign = rows.find(entry => entry.orderId === process.env.E2E_FOREIGN_ORDER_ID)!;
        const scoped = await browser.newContext({ baseURL: 'http://localhost:4317' });
        let roleId: string | undefined;
        const profile = { username: process.env.E2E_ACCOUNTANT_USERNAME!, displayName: 'Scoped reversal acceptance', role: 'ACCOUNTANT', facilityId: process.env.E2E_SHOP_ID! };
        try {
            await login(scoped.request, 'ACCOUNTANT');
            expect((await reverse(scoped.request, own.id)).status()).toBe(403);
            const role = await request.post('/api/roles', { data: { name: `reversal_${randomUUID()}`, displayName: 'Scoped reversal', permissions: ['transactions:reverse'] } });
            expect(role.status()).toBe(200); roleId = (await role.json()).id;
            expect((await request.patch(`/api/users/${process.env.E2E_ACCOUNTANT_ID}`, { data: { ...profile, roleIds: [roleId] } })).status()).toBe(200);
            await login(scoped.request, 'ACCOUNTANT');
            const denied = await reverse(scoped.request, foreign.id);
            expect(denied.status()).toBe(404); expect(await denied.json()).not.toHaveProperty('amount');
            expect(foreign.idempotencyKey).toBeTruthy();
            expect((await reverse(scoped.request, own.id, foreign.idempotencyKey!)).status()).toBe(404);
            const ownExpense = await scoped.request.post('/api/transactions', { data: { type: 'EXPENSE', amount: 2.02, category: 'OTHER', description: 'Scoped accountant correction fixture' } });
            expect(ownExpense.status()).toBe(200);
            const accepted = await reverse(scoped.request, (await ownExpense.json()).id);
            expect(accepted.status()).toBe(200);
            expect(await accepted.json()).toMatchObject({ amount: -2.02, createdBy: process.env.E2E_ACCOUNTANT_ID, facilityId: process.env.E2E_SHOP_ID });
        } finally {
            await scoped.close();
            if (roleId) {
                expect((await request.patch(`/api/users/${process.env.E2E_ACCOUNTANT_ID}`, { data: { ...profile, roleIds: [] } })).status()).toBe(200);
                expect((await request.delete(`/api/roles/${roleId}`)).status()).toBe(200);
            }
        }
    });

    test('one key can be retried concurrently without a second reversal or audit', async ({ request }) => {
        await login(request);
        const { order, original } = await paidOrder(request, 30.10);
        const key = randomUUID();
        const responses = await Promise.all([reverse(request, original.id, key), reverse(request, original.id, key)]);
        expect(responses.map(response => response.status())).toEqual([200, 200]);
        const results = await Promise.all(responses.map(response => response.json()));
        expect(results[0].id).toBe(results[1].id); expect(results[0].amount).toBe(-30.10);
        expect((await reverse(request, original.id, key, 'Different correction reason')).status()).toBe(409);
        const updated = await (await request.get(`/api/orders/${order.id}`)).json();
        expect(updated.paidAmount).toBe(0); expect(updated.remainingAmount).toBe(100);
        const audit = (await (await request.get(`/api/audit?entityType=ORDER&entityId=${order.id}`)).json()).items;
        expect(audit.filter((entry: { action: string }) => entry.action === 'PAYMENT_REVERSED')).toHaveLength(1);
        expect((await entries(request)).filter(entry => entry.reversalOfId === original.id)).toHaveLength(1);
    });

    test('competing keys produce one reversal and leave the source entry intact', async ({ request }) => {
        await login(request);
        const { original } = await paidOrder(request, 25.55);
        expect((await request.post(`/api/transactions/${original.id}/reverse`, { data: { reason: '', idempotencyKey: randomUUID() } })).status()).toBe(400);
        expect((await request.post(`/api/transactions/${original.id}/reverse`, { data: { reason, idempotencyKey: randomUUID(), amount: -1 } })).status()).toBe(400);
        const responses = await Promise.all([reverse(request, original.id), reverse(request, original.id)]);
        expect(responses.map(response => response.status()).sort()).toEqual([200, 409]);
        const rows = await entries(request);
        expect(rows.find(entry => entry.id === original.id)?.amount).toBe(25.55);
        expect(rows.filter(entry => entry.reversalOfId === original.id)).toHaveLength(1);
    });

    test('a new payment and a reversal serialize on one order and preserve its final ledger', async ({ request }) => {
        await login(request);
        const { order, original } = await paidOrder(request, 30);
        const [correction, payment] = await Promise.all([
            reverse(request, original.id),
            request.post('/api/transactions', { data: { type: 'INCOME', amount: 70, category: 'SALES', orderId: order.id, idempotencyKey: randomUUID() } }),
        ]);
        expect(correction.status()).toBe(200); expect(payment.status()).toBe(200);
        const updated = await (await request.get(`/api/orders/${order.id}`)).json();
        expect(updated.paidAmount).toBe(70); expect(updated.remainingAmount).toBe(30);
        const ledger = (await entries(request)).filter(entry => entry.orderId === order.id);
        expect(ledger).toHaveLength(3);
        expect(Math.round(ledger.reduce((sum, entry) => sum + entry.amount, 0) * 100)).toBe(7000);
    });
});
