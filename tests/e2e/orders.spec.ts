import { test, expect } from '@playwright/test';

test.describe('Order Management', () => {
    // Shared login state or login before each
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[name="username"]', 'master');
        await page.fill('input[name="password"]', 'master');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL('http://localhost:3000/');
    });

    test('should create a new order successfully', async ({ page }) => {
        await page.goto('/orders');
        await page.click('text=طلب جديد');

        // Fill Form
        await page.fill('input[name="customerName"]', 'Playwright Test Client');
        await page.fill('input[name="customerPhone"]', '0555555555');
        await page.fill('textarea[name="description"]', 'Test Order from Playwright');
        await page.fill('input[name="totalAmount"]', '500');
        await page.fill('input[name="paidAmount"]', '0');

        // Wait for facilities to populate (1 disabled + 1 real)
        await expect(page.locator('select[name="factoryId"] option')).not.toHaveCount(0);
        await expect(page.locator('select[name="shopId"] option')).not.toHaveCount(0);

        // Select Facilities
        await page.locator('select[name="factoryId"]').selectOption({ index: 1 });
        await page.locator('select[name="shopId"]').selectOption({ index: 1 });

        // Date
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];
        await page.fill('input[name="dueDate"]', dateStr);

        // Submit
        await page.click('button:has-text("إنشاء الطلب")');

        // Verify Redirect to Dashboard (Root)
        await expect(page).toHaveURL('http://localhost:3000/');

        // Check for presence of recent orders list or similar on dashboard
        await expect(page.getByRole('heading', { name: 'آخر الطلبات' })).toBeVisible();
    });

    test('should validate input fields', async ({ page }) => {
        await page.goto('/orders/new');
        await page.click('button:has-text("إنشاء الطلب")');

        // Check for validation messages (HTML5 or Custom)
        // Assuming custom UI error or browser validty
        // Simple check: we are still on the same page
        await expect(page).toHaveURL(/\/orders\/new/);
    });
});
