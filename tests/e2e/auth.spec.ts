import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
    test('should redirect unauthenticated user to login', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveURL(/\/login/);
    });

    test('should login successfully as admin', async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[name="username"]', 'master');
        await page.fill('input[name="password"]', 'master');
        await page.click('button[type="submit"]');

        // Wait for navigation to dashboard/layout
        await expect(page).toHaveURL('http://localhost:3000/');
    });

    test('should show error for invalid credentials', async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[name="username"]', 'wrong');
        await page.fill('input[name="password"]', 'pass');
        await page.click('button[type="submit"]');

        // Expect Arabic error message
        await expect(page.getByText('اسم المستخدم أو كلمة المرور غير صحيحة')).toBeVisible();
    });
});
