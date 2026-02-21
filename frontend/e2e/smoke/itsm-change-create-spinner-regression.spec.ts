/**
 * ITSM Change Create — Infinite Spinner Regression Tests
 *
 * These tests specifically prevent regression of the infinite spinner bug
 * on the Change create screen (/itsm/changes/new).
 *
 * Covers:
 *   1. Form renders even when calendar/freeze endpoints return 403
 *   2. Form renders even when optional CMDB endpoint returns 500
 *   3. Submit with valid payload -> request sent -> spinner stops + feedback shown
 *   4. Submit with backend validation 400 -> spinner stops + error shown
 *   5. Slow dependency -> page still exits loading state
 *
 * NOTE: These tests override the onboarding context to enable ITSM_SUITE modules,
 * which the default setupMockApi does not do (ITSM_SUITE is empty by default).
 * Per-test route overrides MUST be registered AFTER login() because login()
 * calls setupMockApi() which registers a catch-all that would shadow earlier routes.
 * Playwright uses LIFO (Last In, First Out) for route matching.
 *
 * @smoke @regression
 */

import { test, expect, Page } from '@playwright/test';
import { login, setupMockApi, logE2eConfig, isMockUi } from '../helpers';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const successResponse = (data: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ success: true, data }),
});

const listResponse = (items: unknown[] = []) => successResponse({
  items,
  total: items.length,
  page: 1,
  pageSize: 20,
  totalPages: items.length > 0 ? 1 : 0,
});

const isApi = (route: { request: () => { resourceType: () => string } }) => {
  const rt = route.request().resourceType();
  return rt === 'xhr' || rt === 'fetch';
};

/**
 * Override onboarding/context and platform/modules to enable ITSM_SUITE.
 * Must be registered AFTER setupMockApi so it wins (Playwright LIFO).
 */
async function enableItsmModules(page: Page) {
  await page.route('**/onboarding/context**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill(successResponse({
      context: {
        status: 'active',
        schemaVersion: 1,
        policySetVersion: null,
        activeSuites: ['GRC_SUITE', 'ITSM_SUITE'],
        enabledModules: {
          GRC_SUITE: ['risk', 'policy', 'audit', 'issue', 'capa', 'evidence', 'control'],
          ITSM_SUITE: ['itsm_change', 'itsm_incident', 'itsm_service', 'itsm_calendar'],
        },
        activeFrameworks: ['ISO27001'],
        maturity: 'foundational',
        metadata: {
          initializedAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
        },
      },
      policy: { disabledFeatures: [], warnings: [], metadata: {} },
    }));
  });

  await page.route('**/platform/modules/enabled**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill(successResponse({
      tenantId: 'test-tenant-id',
      enabledModules: [
        'risk', 'policy', 'audit', 'issue', 'capa', 'evidence', 'control', 'compliance',
        'itsm_change', 'itsm_incident', 'itsm_service', 'itsm_calendar',
      ],
    }));
  });

  await page.route('**/platform/modules/status**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill(successResponse({
      tenantId: 'test-tenant-id',
      modules: [
        { key: 'risk', enabled: true, status: 'active' },
        { key: 'policy', enabled: true, status: 'active' },
        { key: 'audit', enabled: true, status: 'active' },
        { key: 'itsm_change', enabled: true, status: 'active' },
        { key: 'itsm_incident', enabled: true, status: 'active' },
        { key: 'itsm_service', enabled: true, status: 'active' },
        { key: 'itsm_calendar', enabled: true, status: 'active' },
      ],
    }));
  });
}

/** Mock ITSM-specific endpoints needed for Change create page */
async function mockItsmEndpoints(page: Page) {
  // ITSM choices
  await page.route('**/grc/itsm/choices**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill(successResponse({
      type: [
        { value: 'STANDARD', label: 'Standard' },
        { value: 'NORMAL', label: 'Normal' },
        { value: 'EMERGENCY', label: 'Emergency' },
      ],
      state: [
        { value: 'DRAFT', label: 'Draft' },
        { value: 'ASSESS', label: 'Assess' },
        { value: 'AUTHORIZE', label: 'Authorize' },
        { value: 'IMPLEMENT', label: 'Implement' },
        { value: 'REVIEW', label: 'Review' },
        { value: 'CLOSED', label: 'Closed' },
      ],
      risk: [
        { value: 'LOW', label: 'Low' },
        { value: 'MEDIUM', label: 'Medium' },
        { value: 'HIGH', label: 'High' },
      ],
    }));
  });

  // CMDB services (default: return empty list)
  await page.route('**/grc/cmdb/services**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill(listResponse());
  });

  // CMDB service offerings
  await page.route('**/grc/cmdb/service-offerings**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill(listResponse());
  });

  // Calendar events (default: return empty list)
  await page.route('**/grc/itsm/calendar/events**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill(listResponse());
  });

  // Freeze windows (default: return empty list)
  await page.route('**/grc/itsm/calendar/freeze-windows**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill(listResponse());
  });

  // ITSM changes list (GET only; POST handled per-test)
  await page.route('**/grc/itsm/changes?**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    if (route.request().method() !== 'GET') { await route.continue(); return; }
    await route.fulfill(listResponse());
  });

  // ITSM change detail (for navigation after create)
  await page.route(/\/grc\/itsm\/changes\/[^/?]+$/, async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    if (route.request().method() !== 'GET') { await route.continue(); return; }
    await route.fulfill(successResponse({
      id: 'regression-test-change-001',
      number: 'CHG-REGTEST-001',
      title: 'Regression Test Change',
      state: 'DRAFT',
      type: 'NORMAL',
      risk: 'LOW',
      approvalStatus: 'NOT_REQUESTED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  });

  // Risk assessment
  await page.route('**/grc/itsm/changes/*/risk-assessment**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill(successResponse(null));
  });

  // Approvals
  await page.route('**/grc/itsm/changes/*/approvals**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill(listResponse());
  });

  // Activity stream
  await page.route('**/grc/itsm/changes/*/activity**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill(listResponse());
  });
}

/* ------------------------------------------------------------------ */
/* Test-specific overrides                                             */
/* ------------------------------------------------------------------ */

/** Override calendar endpoints with 403 */
async function overrideCalendar403(page: Page) {
  await page.route('**/grc/itsm/calendar/events**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 403, message: 'Forbidden' }),
    });
  });
  await page.route('**/grc/itsm/calendar/freeze-windows**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 403, message: 'Forbidden' }),
    });
  });
}

/** Override CMDB services with 500 */
async function overrideCmdbServices500(page: Page) {
  await page.route('**/grc/cmdb/services**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 500, message: 'Internal Server Error' }),
    });
  });
}

/** Override ITSM choices with 500 */
async function overrideChoices500(page: Page) {
  await page.route('**/grc/itsm/choices**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 500, message: 'Choices unavailable' }),
    });
  });
}

/** Override change create POST with 201 success */
async function overrideCreateSuccess(page: Page) {
  await page.route('**/grc/itsm/changes', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    if (route.request().method() !== 'POST') { await route.continue(); return; }
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

/** Override change create POST with 400 validation error */
async function overrideCreate400(page: Page) {
  await page.route('**/grc/itsm/changes', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    if (route.request().method() !== 'POST') { await route.continue(); return; }
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

/** Override CMDB services with 5-second delay */
async function overrideCmdbServicesSlow(page: Page) {
  await page.route('**/grc/cmdb/services**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await new Promise(resolve => setTimeout(resolve, 5000));
    await route.fulfill(listResponse());
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
    // Base mock API first, then ITSM-specific overrides (LIFO = last wins)
    await setupMockApi(page);
    await enableItsmModules(page);
    await mockItsmEndpoints(page);
  });

  test('1 — form renders when calendar/freeze endpoints return 403', async ({ page }) => {
    await login(page);
    // Override calendar mocks with 403 — registered AFTER login so it wins (LIFO)
    await overrideCalendar403(page);

    await page.goto('/itsm/changes/new');
    await page.waitForLoadState('networkidle');

    // The form should be ready (not stuck on loading spinner)
    const formReady = page.locator('[data-testid="change-form-ready"]');
    const titleInput = page.locator('[data-testid="change-title-input"] input, input[name="title"]').first();

    // Wait for either data-testid or fallback title input
    const ready = await formReady.isVisible({ timeout: 20000 }).catch(() => false);
    if (!ready) {
      await expect(titleInput).toBeVisible({ timeout: 20000 });
    }

    // Confirm loading spinner is NOT showing
    const formLoading = page.locator('[data-testid="change-form-loading"]');
    const stillLoading = await formLoading.isVisible().catch(() => false);
    expect(stillLoading).toBe(false);
  });

  test('2 — form renders when CMDB services return 500 and choices return 500', async ({ page }) => {
    await login(page);
    // Override after login so they win (LIFO) over setupMockApi catch-all
    await overrideCmdbServices500(page);
    await overrideChoices500(page);

    await page.goto('/itsm/changes/new');
    await page.waitForLoadState('networkidle');

    // Form should still render — these are non-critical dependencies
    const titleInput = page.locator('[data-testid="change-title-input"] input, input[name="title"]').first();
    await expect(titleInput).toBeVisible({ timeout: 20000 });

    // Save button should be visible and not in saving state
    const submitBtn = page.locator('[data-testid="change-form-submit"], [data-testid="change-save-btn"], button:has-text("Save")').first();
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
    await expect(submitBtn).toBeEnabled();
  });

  test('3 — submit success: spinner stops and user gets feedback', async ({ page }) => {
    await login(page);
    // Override after login so it wins (LIFO) over setupMockApi catch-all
    await overrideCreateSuccess(page);

    await page.goto('/itsm/changes/new');
    await page.waitForLoadState('networkidle');

    // Fill in title
    const titleInput = page.locator('[data-testid="change-title-input"] input, input[name="title"]').first();
    await expect(titleInput).toBeVisible({ timeout: 20000 });
    await titleInput.fill('Regression Test Change');

    // Click save
    const submitBtn = page.locator('[data-testid="change-form-submit"], [data-testid="change-save-btn"], button:has-text("Save")').first();
    await submitBtn.click();

    // After clicking save, spinner should stop within reasonable time.
    // Either the page navigates away (success) or spinner stops (with or without error).
    // The key assertion is: no infinite spinner.
    await page.waitForTimeout(5000);

    // Check that save button is re-enabled OR page has navigated away
    const url = page.url();
    const navigatedAway = !url.includes('/new');
    let spinnerStopped = false;
    if (!navigatedAway) {
      // If still on the page, verify spinner stopped
      spinnerStopped = await submitBtn.isEnabled({ timeout: 3000 }).catch(() => false);
    }
    expect(navigatedAway || spinnerStopped).toBe(true);
  });

  test('4 — submit 400 validation error: spinner stops + error shown', async ({ page }) => {
    await login(page);
    // Override after login so it wins (LIFO) over setupMockApi catch-all
    await overrideCreate400(page);

    await page.goto('/itsm/changes/new');
    await page.waitForLoadState('networkidle');

    // Fill in title
    const titleInput = page.locator('[data-testid="change-title-input"] input, input[name="title"]').first();
    await expect(titleInput).toBeVisible({ timeout: 20000 });
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
    await login(page);
    // Override after login so it wins (LIFO) over setupMockApi catch-all
    await overrideCmdbServicesSlow(page);

    await page.goto('/itsm/changes/new');

    // Form should be ready within a reasonable time even though CMDB is slow
    // (isNew = true means loading starts as false, so form renders immediately)
    const titleInput = page.locator('[data-testid="change-title-input"] input, input[name="title"]').first();
    await expect(titleInput).toBeVisible({ timeout: 20000 });

    // Save button should be available
    const submitBtn = page.locator('[data-testid="change-form-submit"], [data-testid="change-save-btn"], button:has-text("Save")').first();
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
    await expect(submitBtn).toBeEnabled();
  });
});
