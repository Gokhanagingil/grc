/**
 * ITSM Change Create Resilience Smoke Test
 *
 * Validates that the Change create form renders even when calendar endpoints
 * return 403 (permission denied), and works normally with 200 responses.
 *
 * @smoke
 */

import { test, expect, Page } from '@playwright/test';
import { login, setupMockApi, TEST_CREDENTIALS } from '../helpers';

const isMockMode = process.env.E2E_MOCK_API === '1';

/**
 * Setup mock API with calendar endpoints returning 403
 */
async function setupCalendar403Mocks(page: Page) {
  await page.route('**/grc/itsm/calendar/events**', async (route) => {
    const req = route.request();
    if (req.resourceType() !== 'xhr' && req.resourceType() !== 'fetch') {
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
    const req = route.request();
    if (req.resourceType() !== 'xhr' && req.resourceType() !== 'fetch') {
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

/**
 * Setup mock API with calendar endpoints returning 200
 */
async function setupCalendar200Mocks(page: Page) {
  await page.route('**/grc/itsm/calendar/events**', async (route) => {
    const req = route.request();
    if (req.resourceType() !== 'xhr' && req.resourceType() !== 'fetch') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
      }),
    });
  });

  await page.route('**/grc/itsm/calendar/freeze-windows**', async (route) => {
    const req = route.request();
    if (req.resourceType() !== 'xhr' && req.resourceType() !== 'fetch') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
      }),
    });
  });
}

test.describe('ITSM Change Create Resilience @smoke', () => {
  test.skip(isMockMode, 'ITSM routes require real backend - mock API does not enable ITSM_SUITE modules');

  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  test('form renders even when calendar endpoints return 403', async ({ page }) => {
    await setupCalendar403Mocks(page);
    await login(page);

    await page.goto('/itsm/changes/new');
    await page.waitForLoadState('networkidle');

    const titleInput = page.locator('[data-testid="change-title-input"] input, input[name="title"]').first();
    await expect(titleInput).toBeVisible({ timeout: 15000 });

    const saveBtn = page.locator('[data-testid="change-save-btn"]');
    const hasSaveBtn = await saveBtn.count();
    if (hasSaveBtn > 0) {
      await expect(saveBtn).toBeVisible({ timeout: 5000 });
    } else {
      const fallbackSaveBtn = page.locator('button:has-text("Save")').first();
      await expect(fallbackSaveBtn).toBeVisible({ timeout: 5000 });
    }
  });

  test('calendar page shows permission banner on 403', async ({ page }) => {
    await setupCalendar403Mocks(page);
    await login(page);

    await page.goto('/itsm/calendar');
    await page.waitForLoadState('networkidle');

    const banner = page.locator('[data-testid="calendar-permission-banner"]');
    await expect(banner).toBeVisible({ timeout: 15000 });
  });

  test('change create form works with 200 calendar responses', async ({ page }) => {
    await setupCalendar200Mocks(page);
    await login(page);

    await page.goto('/itsm/changes/new');
    await page.waitForLoadState('networkidle');

    const titleInput = page.locator('[data-testid="change-title-input"] input, input[name="title"]').first();
    await expect(titleInput).toBeVisible({ timeout: 15000 });

    const saveBtn = page.locator('[data-testid="change-save-btn"]');
    const hasSaveBtn = await saveBtn.count();
    if (hasSaveBtn > 0) {
      await expect(saveBtn).toBeVisible({ timeout: 5000 });
    } else {
      const fallbackSaveBtn = page.locator('button:has-text("Save")').first();
      await expect(fallbackSaveBtn).toBeVisible({ timeout: 5000 });
    }
  });
});
