
import { test, expect } from '@playwright/test';

test('Visual Monthly Simulation', async ({ page }) => {
    test.setTimeout(300000); // 5 minutes

    // 1. Login
    await page.goto('http://localhost:3000');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', '123123');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/');

    // Simulation Loop: Create 5 orders with different scenarios
    const scenarios = [
        { customer: 'شركة الأفق', item: 'تجهيز مكتب كامل', amount: '5000', status: 'COMPLETE' },
        { customer: 'خالد عمر', item: 'غرفة نوم أطفال', amount: '1200', status: 'DELIVER' },
        { customer: 'مطعم الساحل', item: 'طاولات طعام عدد 10', amount: '3500', status: 'PROCESS' },
        { customer: 'سارة أحمد', item: 'دولاب زاوية', amount: '900', status: 'FACTORY' },
        { customer: 'مكتب الرواد', item: 'خزائن ملفات', amount: '2200', status: 'REGISTER' },
    ];

    for (const [index, scenario] of scenarios.entries()) {
        console.log(`Starting Order Simulation: ${scenario.customer}`);

        // Go to New Order
        await page.goto('http://localhost:3000/orders/new');

        // Fill Form
        await page.fill('input[name="customerName"]', scenario.customer);
        await page.fill('input[name="customerPhone"]', `091${1000000 + index}`);
        await page.fill('textarea[name="description"]', scenario.item);
        await page.fill('input[name="totalAmount"]', scenario.amount);
        await page.fill('input[name="dueDate"]', new Date().toISOString().split('T')[0]);

        // Select Factory
        await page.selectOption('select[name="factoryId"]', { index: 1 });

        // Submit
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/.*\/orders\/.*/); // Wait for redirect to details or list

        // If redirect goes to list, click the first order (newest)
        if (page.url().endsWith('/orders')) {
            await page.click('div.border >> nth=0');
        }

        // Process based on desired status
        if (scenario.status !== 'REGISTER') {
            // Admin view usually allows moving status. 
            // We need buttons. Assuming 'OrderActions' are visible.

            // To Factory
            if (await page.isVisible('button:has-text("تحويل للمصنع")')) {
                await page.click('button:has-text("تحويل للمصنع")');
                await page.waitForTimeout(1000); // visual pause
            }

            if (['PROCESS', 'DELIVER', 'COMPLETE'].includes(scenario.status)) {
                // Needs to be done by Factory Manager? Admin usually has permissions.
                // If not, we might need to relogin, but assuming Admin has full access or override.
                // Or we just simulate the "Transfer" which is the main "Factory" generic step.

                if (await page.isVisible('button:has-text("تحويل للتجهيز")')) { // Start Processing
                    await page.click('button:has-text("تحويل للتجهيز")');
                    await page.waitForTimeout(1000);
                }

                if (['DELIVER', 'COMPLETE'].includes(scenario.status)) {
                    if (await page.isVisible('button:has-text("جاهز - إرسال للمحل")')) {
                        await page.click('button:has-text("جاهز - إرسال للمحل")');
                        await page.waitForTimeout(1000);
                    }

                    if (scenario.status === 'COMPLETE') {
                        if (await page.isVisible('button:has-text("تسليم وإنهاء")')) {
                            await page.click('button:has-text("تسليم وإنهاء")');
                        }
                    }
                }
            }
        }

        console.log(`Completed Order: ${scenario.customer}`);
        await page.waitForTimeout(1500); // Pause to let user see
    }

    console.log('Simulation Finished');
});
