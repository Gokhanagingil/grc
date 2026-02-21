/**
 * ITSM Change Create — Infinite Spinner Regression Tests
 *
 * These tests specifically prevent regression of the infinite spinner bug
 * on the Change create screen (/itsm/changes/new).
 *
 * Covers:
 *   1. Form renders even when calendar/freeze endpoints return 403
 *   2. Form renders even when optional CMDB endpoint returns 500
 *   3. Submit with valid payload → request sent → success path → no spinner
 *   4. Submit with backend validation 400 → spinner stops + error shown
 *   5. One slow dependency timeout → page still exits loading state
 *
 * @smoke @regression
 */

import { test, expect, Page } from '@playwright/test';
import { login, setupMockApi, TEST_CREDENTIALS, logE2eConfig, isMockUi } from '../helpers';

/* ------------------------------------------------------------------ */
/* Mock helpers                                                        */
/* ------------------------------------------------------------------ */

/** Intercept calendar endpoints with 403 */
async function mockCalendar403(page: Page) {
  await page.route('**/grc/itsm/calendar/events**', async (route) => {
    if (route.request().resourceType() !== 'xhr' && route.request().resourceType() !== 'fetch') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 403, message: 'Forbidden' }),
    });
  });
  await page.route('**/grc/itsm/calendar/freeze-windows**', async (route) => {
    if (route.request().resourceType() !== 'xhr' && route.request().resourceType() !== 'fetch') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 403, message: 'Forbidden' }),
    });
  });
}

/** Intercept CMDB services endpoint with 500 */
async function mockCmdbServices500(page: Page) {
  await page.route('**/grc/cmdb/services**', async (route) => {
    if (route.request().resourceType() !== 'xhr' && route.request().resourceType() !== 'fetch') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 500, message: 'Internal Server Error' }),
    });
  });
}

/** Intercept ITSM choices endpoint with 500 */
async function mockChoices500(page: Page) {
  await page.route('**/grc/itsm/choices**', async (route) => {
    if (route.request().resourceType() !== 'xhr' && route.request().resourceType() !== 'fetch') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 500, message: 'Choices unavailable' }),
    });
  });
}

/** Intercept change create POST with 201 success */
async function mockCreateSuccess(page: Page) {
  await page.route('**/grc/itsm/changes', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    if (route.request().resourceType() !== 'xhr' && route.request().resourceType() !== 'fetch') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: 'regression-test-change-001',
          number: 'CHG-REGTEST-001',
          title: 'Regression Test Change',
          state: 'DRAFT',
          type: 'NORMAL',
          risk: 'LOW',
          approvalStatus: 'NOT_REQUESTED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    });
  });
}

/** Intercept change create POST with 400 validation error */
async function mockCreate400(page: Page) {
  await page.route('**/grc/itsm/changes', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    if (route.request().resourceType() !== 'xhr' && route.request().resourceType() !== 'fetch') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          fieldErrors: [
            { field: 'title', message: 'Title must be at least 5 characters' },
          ],
        },
      }),
    });
  });
}

/** Intercept CMDB services with a very slow (10s) response to simulate timeout */
async function mockCmdbServicesTimeout(page: Page) {
  await page.route('**/grc/cmdb/services**', async (route) => {
    if (route.request().resourceType() !== 'xhr' && route.request().resourceType() !== 'fetch') {
      await route.continue();
      return;
    }
    // Simulate a 10-second delay — the page should still render before this completes
    await new Promise(resolve => setTimeout(resolve, 10000));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 } }),
    });
  });
}

/* ------------------------------------------------------------------ */
/* Test suite                                                          */
/* ------------------------------------------------------------------ */

test.describe('ITSM Change Create — Infinite Spinner Regression @mock @smoke @regression', () => {
  test.beforeAll(() => {
    logE2eConfig('ITSM Change Create Spinner Regression');
  });

  // These tests use mocked APIs so they can run in MOCK_UI mode
  test.skip(() => !isMockUi(), 'These regression tests require MOCK_UI mode');

  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  test('1 — form renders when calendar/freeze endpoints return 403', async ({ page }) => {
    await mockCalendar403(page);
    await login(page);

    await page.goto('/itsm/changes/new');
    await page.waitForLoadState('networkidle');

    // The form should be ready (not stuck on loading spinner)
    const formReady = page.locator('[data-testid="change-form-ready"]');
    const formLoading = page.locator('[data-testid="change-form-loading"]');

    // Either the new data-testid exists, or we fall back to checking the title input
    const ready = await formReady.isVisible({ timeout: 15000 }).catch(() => false);
    if (!ready) {
      // Fallback: check title input is visible
      const titleInput = page.locator('[data-testid="change-title-input"] input, input[name="title"]').first();
      await expect(titleInput).toBeVisible({ timeout: 15000 });
    }

    // Confirm loading spinner is NOT showing
    const stillLoading = await formLoading.isVisible().catch(() => false);
    expect(stillLoading).toBe(false);
  });

  test('2 — form renders when CMDB services return 500 and choices return 500', async ({ page }) => {
    await mockCmdbServices500(page);
    await mockChoices500(page);
    await login(page);

    await page.goto('/itsm/changes/new');
    await page.waitForLoadState('networkidle');

    // Form should still render — these are non-critical dependencies
    const titleInput = page.locator('[data-testid="change-title-input"] input, input[name="title"]').first();
    await expect(titleInput).toBeVisible({ timeout: 15000 });

    // Save button should be visible and not in saving state
    const submitBtn = page.locator('[data-testid="change-form-submit"], [data-testid="change-save-btn"], button:has-text("Save")').first();
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
    await expect(submitBtn).toBeEnabled();
  });

  test('3 — submit success: spinner exits + navigates away', async ({ page }) => {
    await mockCreateSuccess(page);
    await login(page);

    await page.goto('/itsm/changes/new');
    await page.waitForLoadState('networkidle');

    // Fill in title
    const titleInput = page.locator('[data-testid="change-title-input"] input, input[name="title"]').first();
    await expect(titleInput).toBeVisible({ timeout: 15000 });
    await titleInput.fill('Regression Test Change');

    // Click save
    const submitBtn = page.locator('[data-testid="change-form-submit"], [data-testid="change-save-btn"], button:has-text("Save")').first();
    await submitBtn.click();

    // After successful create, should navigate away from /new
    await page.waitForTimeout(3000);
    const url = page.url();
    // Should have navigated to detail page or list
    expect(url).not.toContain('/new');
  });

  test('4 — submit 400 validation error: spinner stops + error shown', async ({ page }) => {
    await mockCreate400(page);
    await login(page);

    await page.goto('/itsm/changes/new');
    await page.waitForLoadState('networkidle');

    // Fill in title
    const titleInput = page.locator('[data-testid="change-title-input"] input, input[name="title"]').first();
    await expect(titleInput).toBeVisible({ timeout: 15000 });
    await titleInput.fill('Bad');

    // Click save
    const submitBtn = page.locator('[data-testid="change-form-submit"], [data-testid="change-save-btn"], button:has-text("Save")').first();
    await submitBtn.click();

    // Wait for the error to be processed
    await page.waitForTimeout(2000);

    // Save button should be re-enabled (spinner stopped)
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });

    // Error should be visible — either inline banner or notification toast
    const errorBanner = page.locator('[data-testid="change-form-error"]');
    const toast = page.locator('.MuiAlert-standardError, [role="alert"]').first();
    const hasError = await errorBanner.isVisible({ timeout: 3000 }).catch(() => false);
    const hasToast = await toast.isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasError || hasToast).toBe(true);
  });

  test('5 — slow dependency does not block form render', async ({ page }) => {
    await mockCmdbServicesTimeout(page);
    await login(page);

    await page.goto('/itsm/changes/new');

    // Form should be ready within a reasonable time even though CMDB is slow
    const titleInput = page.locator('[data-testid="change-title-input"] input, input[name="title"]').first();
    await expect(titleInput).toBeVisible({ timeout: 10000 });

    // Save button should be available
    const submitBtn = page.locator('[data-testid="change-form-submit"], [data-testid="change-save-btn"], button:has-text("Save")').first();
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
    await expect(submitBtn).toBeEnabled();
  });
});
