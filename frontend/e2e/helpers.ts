import { Page, expect } from '@playwright/test';

/**
 * Test credentials - can be overridden via environment variables
 */
export const TEST_CREDENTIALS = {
  email: process.env.E2E_EMAIL || 'admin@grc-platform.local',
  password: process.env.E2E_PASSWORD || 'TestPassword123!',
};

/**
 * Login helper function
 */
export async function login(page: Page) {
  await page.goto('/login');
  await expect(page.getByTestId('page-login-title')).toBeVisible();
  
  await page.getByTestId('input-username').fill(TEST_CREDENTIALS.email);
  await page.getByTestId('input-password').fill(TEST_CREDENTIALS.password);
  await page.getByTestId('btn-submit-login').click();
  
  // Wait for navigation to dashboard after login
  await page.waitForURL(/\/(dashboard|admin)/);
}

/**
 * Wait for API response helper
 */
export async function waitForApiResponse(page: Page, urlPattern: string | RegExp, timeout = 10000) {
  return page.waitForResponse(
    (response) => {
      const url = response.url();
      return typeof urlPattern === 'string' ? url.includes(urlPattern) : urlPattern.test(url);
    },
    { timeout }
  );
}

