import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';

// The E2E server reads the ignored local development environment from the repo root.
dotenv.config({ path: path.resolve(__dirname, '../../.env.local'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

export default defineConfig({
    testDir: '../../tests/e2e',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:4317',
        ...(process.env.E2E_CHROME_PATH ? { launchOptions: { executablePath: process.env.E2E_CHROME_PATH } } : {}),
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'node .next/standalone/server.js',
        cwd: path.resolve(__dirname, '../..'),
        url: 'http://localhost:4317/api/health',
        reuseExistingServer: false,
        env: {
            PORT: '4317',
            HOSTNAME: '127.0.0.1',
            AUTH_TRUST_HOST: 'true',
            AUTH_URL: 'http://localhost:4317',
            NEXTAUTH_URL: 'http://localhost:4317',
        },
        timeout: 120 * 1000,
    },
});
