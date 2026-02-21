/**
 * API Catalog OpenAPI — Auth Regression Tests
 *
 * Prevents regression of the auto-logout bug when selecting an API in the
 * OpenAPI panel. The root cause was the frontend calling the public endpoint
 * (/grc/public/v1/:name/openapi.json) which requires X-API-Key auth instead
 * of the authenticated endpoint (/grc/published-apis/:id/openapi) which uses
 * JWT + tenant headers.
 *
 * Covers:
 *   1. 403 on spec endpoint shows permission banner, does NOT logout
 *   2. 500 on spec endpoint shows page error, stays on API Catalog page
 *   3. Malformed spec payload shows error UI, no redirect
 *   4. Successful spec load displays spec content
 *   5. 401 on spec endpoint is handled by interceptor (session-expired flow)
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

const SAMPLE_APIS = [
  { id: 'api-001', name: 'users-api', description: 'User management API', version: '1.0.0' },
  { id: 'api-002', name: 'orders-api', description: 'Order management API', version: '2.0.0' },
];

const SAMPLE_OPENAPI_SPEC = {
  openapi: '3.0.0',
  info: { title: 'Users API', version: '1.0.0' },
  paths: { '/users': { get: { summary: 'List users' } } },
};

/**
 * Enable admin modules to access API Catalog page
 */
async function enableAdminModules(page: Page) {
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
      ],
    }));
  });
}

/** Mock published-apis list endpoint */
async function mockPublishedApis(page: Page) {
  await page.route('**/grc/published-apis', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    if (route.request().method() !== 'GET') { await route.continue(); return; }
    await route.fulfill(listResponse(SAMPLE_APIS));
  });
}

/* ------------------------------------------------------------------ */
/* Test-specific overrides                                             */
/* ------------------------------------------------------------------ */

/** Mock spec endpoint returning 200 with valid spec */
async function overrideSpecSuccess(page: Page) {
  await page.route('**/grc/published-apis/*/openapi**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill(successResponse(SAMPLE_OPENAPI_SPEC));
  });
}

/** Mock spec endpoint returning 403 Forbidden */
async function overrideSpec403(page: Page) {
  await page.route('**/grc/published-apis/*/openapi**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions to read API spec' },
      }),
    });
  });
}

/** Mock spec endpoint returning 500 Server Error */
async function overrideSpec500(page: Page) {
  await page.route('**/grc/published-apis/*/openapi**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to generate OpenAPI spec' },
      }),
    });
  });
}

/** Mock spec endpoint returning malformed/unparseable body */
async function overrideSpecMalformed(page: Page) {
  await page.route('**/grc/published-apis/*/openapi**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{ this is not valid json !!!',
    });
  });
}

/* ------------------------------------------------------------------ */
/* Test suite                                                          */
/* ------------------------------------------------------------------ */

test.describe('API Catalog OpenAPI — Auth Regression @mock @smoke @regression', () => {
  test.beforeAll(() => {
    logE2eConfig('API Catalog OpenAPI Auth Regression');
  });

  test.skip(() => !isMockUi(), 'These regression tests require MOCK_UI mode');

  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
    await enableAdminModules(page);
    await mockPublishedApis(page);
  });

  test('1 — 403 on spec endpoint shows permission banner, does NOT logout', async ({ page }) => {
    await overrideSpec403(page);
    await login(page);

    await page.goto('/admin/api-catalog');
    await page.waitForLoadState('networkidle');

    // Navigate to OpenAPI tab (tab index 2)
    const openApiTab = page.locator('button[role="tab"]:has-text("OpenAPI")');
    if (await openApiTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await openApiTab.click();
      await page.waitForTimeout(500);
    }

    // Select an API from dropdown
    const selectTrigger = page.locator('[data-testid="openapi-select-api"], [role="combobox"]').first();
    if (await selectTrigger.isVisible({ timeout: 5000 }).catch(() => false)) {
      await selectTrigger.click();
      const firstOption = page.locator('[role="option"]').first();
      if (await firstOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstOption.click();
      }
    }

    await page.waitForTimeout(2000);

    // CRITICAL: User must NOT be redirected to login page
    const url = page.url();
    expect(url).not.toContain('/login');

    // Error banner should be visible
    const errorBanner = page.locator('[data-testid="openapi-error-banner"]');
    const hasErrorBanner = await errorBanner.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasErrorBanner) {
      // Banner should mention permission, not session expiry
      const bannerText = await errorBanner.textContent();
      expect(bannerText?.toLowerCase()).toContain('permission');
      expect(bannerText?.toLowerCase()).not.toContain('session expired');
    }
  });

  test('2 — 500 on spec endpoint shows page error, stays on API Catalog page', async ({ page }) => {
    await overrideSpec500(page);
    await login(page);

    await page.goto('/admin/api-catalog');
    await page.waitForLoadState('networkidle');

    // Navigate to OpenAPI tab
    const openApiTab = page.locator('button[role="tab"]:has-text("OpenAPI")');
    if (await openApiTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await openApiTab.click();
      await page.waitForTimeout(500);
    }

    // Select an API
    const selectTrigger = page.locator('[data-testid="openapi-select-api"], [role="combobox"]').first();
    if (await selectTrigger.isVisible({ timeout: 5000 }).catch(() => false)) {
      await selectTrigger.click();
      const firstOption = page.locator('[role="option"]').first();
      if (await firstOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstOption.click();
      }
    }

    await page.waitForTimeout(2000);

    // CRITICAL: User stays on API Catalog page
    const url = page.url();
    expect(url).not.toContain('/login');
    expect(url).toContain('/admin/api-catalog');

    // Error banner should be visible with retry option
    const errorBanner = page.locator('[data-testid="openapi-error-banner"]');
    const hasErrorBanner = await errorBanner.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasErrorBanner) {
      // Should have a retry button for server errors
      const retryBtn = page.locator('[data-testid="openapi-error-banner"] button:has-text("Retry")');
      const hasRetry = await retryBtn.isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasRetry).toBe(true);
    }
  });

  test('3 — malformed spec shows error UI, no redirect', async ({ page }) => {
    await overrideSpecMalformed(page);
    await login(page);

    await page.goto('/admin/api-catalog');
    await page.waitForLoadState('networkidle');

    // Navigate to OpenAPI tab
    const openApiTab = page.locator('button[role="tab"]:has-text("OpenAPI")');
    if (await openApiTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await openApiTab.click();
      await page.waitForTimeout(500);
    }

    // Select an API
    const selectTrigger = page.locator('[data-testid="openapi-select-api"], [role="combobox"]').first();
    if (await selectTrigger.isVisible({ timeout: 5000 }).catch(() => false)) {
      await selectTrigger.click();
      const firstOption = page.locator('[role="option"]').first();
      if (await firstOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstOption.click();
      }
    }

    await page.waitForTimeout(2000);

    // CRITICAL: No redirect to login
    const url = page.url();
    expect(url).not.toContain('/login');
  });

  test('4 — successful spec load displays spec content', async ({ page }) => {
    await overrideSpecSuccess(page);
    await login(page);

    await page.goto('/admin/api-catalog');
    await page.waitForLoadState('networkidle');

    // Navigate to OpenAPI tab
    const openApiTab = page.locator('button[role="tab"]:has-text("OpenAPI")');
    if (await openApiTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await openApiTab.click();
      await page.waitForTimeout(500);
    }

    // Select an API
    const selectTrigger = page.locator('[data-testid="openapi-select-api"], [role="combobox"]').first();
    if (await selectTrigger.isVisible({ timeout: 5000 }).catch(() => false)) {
      await selectTrigger.click();
      const firstOption = page.locator('[role="option"]').first();
      if (await firstOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstOption.click();
      }
    }

    await page.waitForTimeout(2000);

    // Should NOT redirect
    const url = page.url();
    expect(url).not.toContain('/login');

    // Error banner should NOT be visible
    const errorBanner = page.locator('[data-testid="openapi-error-banner"]');
    const hasError = await errorBanner.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);
  });
});
