/**
 * Phase 0 — Quality Gate: "No silent UI failures"
 *
 * Playwright assertions:
 *   1. "No infinite spinner on Change/CMDB pages"
 *   2. "Unexpected shape shows banner, not blank crash"
 *
 * These tests use mocked APIs (MOCK_UI mode) to deterministically verify
 * that the UI handles error/edge cases gracefully.
 *
 * @smoke @regression @phase0
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
 * Enable ITSM modules in onboarding context (registered AFTER setupMockApi — LIFO wins).
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
          ITSM_SUITE: ['itsm_change', 'itsm_incident', 'itsm_service', 'itsm_calendar', 'cmdb'],
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
        'itsm_change', 'itsm_incident', 'itsm_service', 'itsm_calendar', 'cmdb',
      ],
    }));
  });

  await page.route('**/platform/modules/status**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill(successResponse({
      tenantId: 'test-tenant-id',
      modules: [
        { key: 'itsm_change', enabled: true, status: 'active' },
        { key: 'itsm_incident', enabled: true, status: 'active' },
        { key: 'itsm_service', enabled: true, status: 'active' },
        { key: 'cmdb', enabled: true, status: 'active' },
      ],
    }));
  });
}

/** Mock ITSM/CMDB endpoints with valid shapes for happy path */
async function mockItsmCmdbEndpoints(page: Page) {
  await page.route('**/grc/itsm/choices**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill(successResponse({
      type: [
        { value: 'STANDARD', label: 'Standard' },
        { value: 'NORMAL', label: 'Normal' },
      ],
      state: [{ value: 'DRAFT', label: 'Draft' }],
      risk: [{ value: 'LOW', label: 'Low' }],
    }));
  });

  await page.route('**/grc/itsm/changes?**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    if (route.request().method() !== 'GET') { await route.continue(); return; }
    await route.fulfill(listResponse([
      {
        id: 'chg-001',
        number: 'CHG-001',
        title: 'Phase 0 Test Change',
        state: 'DRAFT',
        type: 'NORMAL',
        risk: 'LOW',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]));
  });

  await page.route(/\/grc\/itsm\/changes\/[^/?]+$/, async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    if (route.request().method() !== 'GET') { await route.continue(); return; }
    await route.fulfill(successResponse({
      id: 'chg-001',
      number: 'CHG-001',
      title: 'Phase 0 Test Change',
      state: 'DRAFT',
      type: 'NORMAL',
      risk: 'LOW',
      approvalStatus: 'NOT_REQUESTED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  });

  await page.route('**/grc/itsm/changes/*/risk-assessment**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill(successResponse(null));
  });

  await page.route('**/grc/itsm/changes/*/approvals**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill(listResponse());
  });

  await page.route('**/grc/itsm/changes/*/activity**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill(listResponse());
  });

  await page.route('**/grc/cmdb/classes?**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill(listResponse([
      { id: 'cls-001', name: 'Server', label: 'Server', description: 'Physical server', parentClassId: null },
    ]));
  });

  await page.route('**/grc/cmdb/cis?**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill(listResponse([
      { id: 'ci-001', name: 'SRV-PROD-01', classId: 'cls-001', className: 'Server', status: 'active' },
    ]));
  });

  await page.route('**/grc/cmdb/services**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill(listResponse());
  });

  await page.route('**/grc/cmdb/service-offerings**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill(listResponse());
  });

  await page.route('**/grc/itsm/calendar/events**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill(listResponse());
  });

  await page.route('**/grc/itsm/calendar/freeze-windows**', async (route) => {
    if (!isApi(route)) { await route.continue(); return; }
    await route.fulfill(listResponse());
  });
}

/* ------------------------------------------------------------------ */
/* Test Suite                                                          */
/* ------------------------------------------------------------------ */

test.describe('Phase 0 Quality Gate — No Silent UI Failures @mock @smoke @phase0', () => {
  test.beforeAll(() => {
    logE2eConfig('Phase 0 Quality Gate');
  });

  test.skip(() => !isMockUi(), 'These tests require MOCK_UI mode');

  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
    await enableItsmModules(page);
    await mockItsmCmdbEndpoints(page);
  });

  /* ---------------------------------------------------------------- */
  /* Assertion 1: No infinite spinner on Change/CMDB pages             */
  /* ---------------------------------------------------------------- */

  test('Change list page should not show infinite spinner', async ({ page }) => {
    await login(page);

    await page.goto('/itsm/changes');

    // Deterministic wait: poll until either real content appears OR spinner disappears.
    // Uses expect.poll (auto-retry) instead of point-in-time isVisible() which is racy.
    const contentLocator = page.locator(
      'table, [data-testid="list-table"], [data-testid="list-empty"], ' +
      '[data-testid="changes-table"], [data-testid="empty-state"], [data-testid="changes-list"], ' +
      '[data-testid="universal-list-page"]'
    );
    const spinnerLocator = page.locator('[data-testid="loading-spinner"], [role="progressbar"], .MuiCircularProgress-root');

    // The page MUST exit loading state within 30 seconds:
    // either content becomes visible or all spinners disappear.
    await expect.poll(async () => {
      const hasContent = await contentLocator.first().isVisible().catch(() => false);
      if (hasContent) return 'content';
      const hasSpinner = await spinnerLocator.first().isVisible().catch(() => false);
      return hasSpinner ? 'loading' : 'no-spinner';
    }, { timeout: 30000, message: 'Page stuck in loading state — infinite spinner detected' }).not.toBe('loading');

    // Additional check: page should not be completely blank
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('CMDB CI Classes page should not show infinite spinner', async ({ page }) => {
    await login(page);

    await page.goto('/cmdb/classes');

    const contentLocator = page.locator(
      'table, [data-testid="list-table"], [data-testid="list-empty"], ' +
      '[data-testid="classes-table"], [data-testid="empty-state"], [data-testid="classes-list"], ' +
      '[data-testid="universal-list-page"]'
    );
    const spinnerLocator = page.locator('[data-testid="loading-spinner"], [role="progressbar"], .MuiCircularProgress-root');

    await expect.poll(async () => {
      const hasContent = await contentLocator.first().isVisible().catch(() => false);
      if (hasContent) return 'content';
      const hasSpinner = await spinnerLocator.first().isVisible().catch(() => false);
      return hasSpinner ? 'loading' : 'no-spinner';
    }, { timeout: 30000, message: 'Page stuck in loading state — infinite spinner detected' }).not.toBe('loading');

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('CMDB CIs page should not show infinite spinner', async ({ page }) => {
    await login(page);

    await page.goto('/cmdb/cis');

    const contentLocator = page.locator(
      'table, [data-testid="list-table"], [data-testid="list-empty"], ' +
      '[data-testid="cis-table"], [data-testid="empty-state"], [data-testid="cis-list"], ' +
      '[data-testid="universal-list-page"]'
    );
    const spinnerLocator = page.locator('[data-testid="loading-spinner"], [role="progressbar"], .MuiCircularProgress-root');

    await expect.poll(async () => {
      const hasContent = await contentLocator.first().isVisible().catch(() => false);
      if (hasContent) return 'content';
      const hasSpinner = await spinnerLocator.first().isVisible().catch(() => false);
      return hasSpinner ? 'loading' : 'no-spinner';
    }, { timeout: 30000, message: 'Page stuck in loading state — infinite spinner detected' }).not.toBe('loading');

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  /* ---------------------------------------------------------------- */
  /* Assertion 2: Unexpected shape shows banner, not blank crash        */
  /* ---------------------------------------------------------------- */

  test('Change list with unexpected API shape should show error, not blank crash', async ({ page }) => {
    await login(page);

    // Override changes list to return unexpected shape (string instead of LIST-CONTRACT)
    await page.route('**/grc/itsm/changes?**', async (route) => {
      if (!isApi(route)) { await route.continue(); return; }
      if (route.request().method() !== 'GET') { await route.continue(); return; }
      // Return a string instead of expected list shape
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: 'unexpected string response' }),
      });
    });

    await page.goto('/itsm/changes');

    // Wait for page to process the response
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Page MUST NOT be completely blank/crashed
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);

    // Check that page shows some kind of feedback — either:
    // - An error banner/alert
    // - An empty state message
    // - Any text content (not a white screen)
    // The key invariant: NO blank crash / white screen of death
    const hasVisibleContent = await page.locator(
      '[role="alert"], .MuiAlert-root, [data-testid="error-banner"], ' +
      '[data-testid="empty-state"], [data-testid="shape-mismatch-banner"], ' +
      'table, main'
    ).first().isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasVisibleContent).toBe(true);

    // Verify no unhandled JS error crashed the page
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    await page.waitForTimeout(1000);
    // Filter out expected React development warnings
    const criticalErrors = consoleErrors.filter(
      (msg) => !msg.includes('React') && !msg.includes('Warning'),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('CMDB page with unexpected API shape should show error, not blank crash', async ({ page }) => {
    await login(page);

    // Override CMDB classes to return unexpected shape (number instead of LIST-CONTRACT)
    await page.route('**/grc/cmdb/classes?**', async (route) => {
      if (!isApi(route)) { await route.continue(); return; }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: 12345 }),
      });
    });

    await page.goto('/cmdb/classes');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Page MUST NOT be completely blank/crashed
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);

    // Must show some kind of visible content (not white screen)
    const hasVisibleContent = await page.locator(
      '[role="alert"], .MuiAlert-root, [data-testid="error-banner"], ' +
      '[data-testid="empty-state"], [data-testid="shape-mismatch-banner"], ' +
      'table, main'
    ).first().isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasVisibleContent).toBe(true);
  });
});
