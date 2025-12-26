import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * See https://playwright.dev/docs/test-configuration.
 * 
 * Projects:
 * - default: Local development (http://localhost:3000)
 * - staging: Staging environment (http://46.224.99.150 or E2E_BASE_URL)
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        /* Base URL to use in actions like `await page.goto('/')`. */
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
        /* Set desktop viewport to ensure sidebar is always visible */
        viewport: { width: 1440, height: 900 },
        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',
        /* Take screenshot on failure */
        screenshot: 'only-on-failure',
        /* Record video on failure */
        video: 'retain-on-failure',
        /* Set environment variables for the browser context */
        extraHTTPHeaders: {},
      },
    },
    {
      name: 'staging',
      use: {
        ...devices['Desktop Chrome'],
        /* Staging base URL */
        baseURL: process.env.E2E_BASE_URL || 'http://46.224.99.150',
        /* Set desktop viewport to ensure sidebar is always visible */
        viewport: { width: 1440, height: 900 },
        /* More retries for staging (network flakiness) */
        retries: 1,
        /* Higher timeout for staging */
        actionTimeout: 15000,
        navigationTimeout: 30000,
        /* Always collect trace for staging (helps debug remote issues) */
        trace: 'on',
        /* Always take screenshots and videos for staging */
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});

