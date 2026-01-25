import { test, expect } from '@playwright/test';

test.describe('Input Validation Tests', () => {

    test.beforeEach(async ({ page }) => {
        // Login as admin for all tests
        await page.goto('/login');
        await page.fill('input[name="username"]', 'admin');
        await page.fill('input[name="password"]', 'admin123');
        await page.click('button[type="submit"]');
    });

    test('User Creation: Invalid Phone Number', async ({ page }) => {
        await page.goto('/admin/users/new');
        await page.fill('input[aria-label="اسم المستخدم"]', 'testuser');
        await page.fill('input[aria-label="الاسم الظاهر"]', 'Test User');
        await page.fill('input[aria-label="رقم الهاتف"]', '123'); // Invalid phone
        await page.fill('input[aria-label="كلمة المرور"]', 'password123');
        await page.click('button[type="submit"]');

        await expect(page.locator('text=رقم الهاتف غير صحيح')).toBeVisible();
    });

    test('Facility Creation: Short Name', async ({ page }) => {
        await page.goto('/facilities/new');
        await page.fill('input[name="name"]', 'A'); // Too short
        await page.fill('input[name="location"]', 'Cairo');
        await page.click('button[type="submit"]');

        await expect(page.locator('text=اسم المنشأة يجب أن يكون حرفين على الأقل')).toBeVisible();
    });

    test('Order Creation: Invalid Phone', async ({ page }) => {
        await page.goto('/orders/new');
        await page.fill('input[name="customerName"]', 'Customer Name');
        await page.fill('input[name="customerPhone"]', 'abc'); // Invalid phone
        await page.fill('textarea[name="description"]', 'Long enough description');
        await page.fill('input[name="totalAmount"]', '100');
        await page.fill('input[name="dueDate"]', '2026-12-31');

        const factorySelect = page.locator('select[name="factoryId"]');
        await factorySelect.selectOption({ index: 1 });

        await page.click('button[type="submit"]');

        await expect(page.locator('text=رقم الهاتف غير صحيح')).toBeVisible();
    });

    test('Order Creation: Negative Price', async ({ page }) => {
        await page.goto('/orders/new');
        await page.fill('input[name="customerName"]', 'Customer Name');
        await page.fill('input[name="customerPhone"]', '0123456789');
        await page.fill('textarea[name="description"]', 'Long enough description');
        await page.fill('input[name="totalAmount"]', '-100'); // Negative price
        await page.fill('input[name="dueDate"]', '2026-12-31');

        const factorySelect = page.locator('select[name="factoryId"]');
        await factorySelect.selectOption({ index: 1 });

        await page.click('button[type="submit"]');

        await expect(page.locator('text=الإجمالي يجب أن يكون قيمة موجبة')).toBeVisible();
    });
});
