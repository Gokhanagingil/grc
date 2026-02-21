import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * See https://playwright.dev/docs/test-configuration.
 *
 * Projects:
 * - mock-ui:    Fast UI regression (route interception, no backend). E2E_MODE=MOCK_UI
 * - real-stack: Real API validation (docker compose / staging).      E2E_MODE=REAL_STACK
 * - staging:    Remote staging environment (REAL_STACK, secrets required).
 *
 * See docs/runbooks/E2E-MODES.md for full details.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  projects: [
    {
      name: 'mock-ui',
      testDir: './e2e',
      testMatch: '**/*.spec.ts',
      grep: /@mock/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3000',
        viewport: { width: 1440, height: 900 },
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        extraHTTPHeaders: {},
      },
    },
    {
      name: 'real-stack',
      testDir: './e2e',
      testMatch: '**/*.spec.ts',
      grep: /@real/,
      grepInvert: /@mock/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
        viewport: { width: 1440, height: 900 },
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        extraHTTPHeaders: {},
      },
    },
    {
      name: 'chromium',
      testDir: './e2e',
      testMatch: '**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
        viewport: { width: 1440, height: 900 },
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        extraHTTPHeaders: {},
      },
    },
    {
      name: 'staging',
      testDir: './e2e',
      testMatch: '**/*.spec.ts',
      grep: /@real/,
      grepInvert: /@mock/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.E2E_BASE_URL || 'http://46.224.99.150',
        viewport: { width: 1440, height: 900 },
        actionTimeout: 15000,
        navigationTimeout: 30000,
        trace: 'on',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
      },
    },
  ],
});

