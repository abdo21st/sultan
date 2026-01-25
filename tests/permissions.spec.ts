import { test, expect } from '@playwright/test';

test.describe('Permission System Tests', () => {

    test('Admin can see all management buttons', async ({ page }) => {
        // 1. Login
        await page.goto('/login');
        await page.fill('input[name="username"]', 'admin');
        await page.fill('input[name="password"]', 'admin123');
        await page.click('button[type="submit"]');

        // 2. Check Order page
        await page.goto('/orders');
        await expect(page.locator('text=طلب جديد')).toBeVisible();

        // 3. Check Admin pages
        await page.goto('/admin/users');
        await expect(page.locator('h1')).toContainText('إدارة المستخدمين');
    });

    test('Accountant cannot see Add Order button', async ({ page }) => {
        // 1. Login
        await page.goto('/login');
        await page.fill('input[name="username"]', 'accountant');
        await page.fill('input[name="password"]', 'acc123');
        await page.click('button[type="submit"]');

        // 2. Check Order page
        await page.goto('/orders');
        await expect(page.locator('text=طلب جديد')).not.toBeVisible();

        // 3. Try access restricted page
        await page.goto('/admin/users');
        // Assuming middleware redirects or shows error page
        await expect(page).not.toHaveURL('/admin/users');
    });

    test('Receptionist can add order but not delete', async ({ page }) => {
        // 1. Login
        await page.goto('/login');
        await page.fill('input[name="username"]', 'receptionist');
        await page.fill('input[name="password"]', 'rec123');
        await page.click('button[type="submit"]');

        // 2. Check Order page
        await page.goto('/orders');
        await expect(page.locator('text=طلب جديد')).toBeVisible();

        // 3. Check for delete buttons
        // Wait for orders to load
        await page.waitForTimeout(1000);
        await expect(page.locator('button[title="حذف"]')).not.toBeVisible();
    });

});
