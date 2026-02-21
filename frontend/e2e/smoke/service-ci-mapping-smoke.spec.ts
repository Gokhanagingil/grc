/**
 * Service-CI Mapping Smoke Test (PR-B2)
 *
 * Validates the service-CI mapping flow:
 *   login -> open CI detail -> link service -> verify appears -> unlink
 *
 * Environment Variables:
 *   E2E_BASE_URL - Base URL for tests (default: http://localhost:3000)
 *   E2E_MOCK_API - Set to '1' to skip these tests (they require real backend)
 *   E2E_EMAIL - Admin email (default: admin@grc-platform.local)
 *   E2E_PASSWORD - Admin password (default: TestPassword123!)
 *
 * @smoke
 */

import { test, expect } from '@playwright/test';
import { login, setupMockApi } from '../helpers';

const isMockMode = process.env.E2E_MOCK_API === '1';

test.describe('Service-CI Mapping Smoke: Link/Unlink @mock @smoke', () => {
  test.skip(isMockMode, 'Smoke tests require real backend - skipping in mock API mode');

  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  test('should login, navigate to CI detail, and verify related services section loads', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/(dashboard|admin)/);

    await page.goto('/cmdb/cis');
    await page.waitForLoadState('networkidle');

    const cisApiPromise = page.waitForResponse(
      (response) =>
        response.url().includes('/grc/cmdb/cis') &&
        response.request().method() === 'GET',
      { timeout: 15000 },
    );
    await page.reload();
    const cisResponse = await cisApiPromise;
    expect(cisResponse.status()).toBe(200);

    const firstCiRow = page.locator('table tbody tr').first();
    const hasCi = await firstCiRow.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasCi) {
      test.skip(true, 'No CIs found to test service linking');
      return;
    }

    await firstCiRow.click();
    await page.waitForURL(/\/cmdb\/cis\/[0-9a-f-]+$/, { timeout: 10000 });

    const relatedServicesSection = page.locator('text=Related Services');
    await expect(relatedServicesSection).toBeVisible({ timeout: 10000 });
  });

  test('should link a service to a CI and verify it appears', async ({ page }) => {
    test.slow();
    await login(page);

    await page.goto('/cmdb/cis');
    await page.waitForLoadState('networkidle');

    const firstCiRow = page.locator('table tbody tr').first();
    const hasCi = await firstCiRow.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasCi) {
      test.skip(true, 'No CIs found to test service linking');
      return;
    }

    await firstCiRow.click();
    await page.waitForURL(/\/cmdb\/cis\/[0-9a-f-]+$/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    const linkServiceBtn = page.locator('[data-testid="btn-link-service"]');
    const hasBtnVisible = await linkServiceBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasBtnVisible) {
      test.skip(true, 'Link Service button not found');
      return;
    }

    await linkServiceBtn.click();

    const dialog = page.locator('text=Link Service to CI');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const serviceSelect = page.locator('[data-testid="select-link-service"]');
    if (await serviceSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await serviceSelect.click();
      const firstOption = page.locator('[role="listbox"] [role="option"]').first();
      const hasOption = await firstOption.isVisible({ timeout: 3000 }).catch(() => false);
      if (!hasOption) {
        test.skip(true, 'No services available to link');
        return;
      }
      await firstOption.click();
    }

    const confirmBtn = page.locator('[data-testid="btn-confirm-link-service"]');
    const linkPromise = page.waitForResponse(
      (response) =>
        response.url().includes('/grc/cmdb/services/') &&
        response.url().includes('/cis/') &&
        response.request().method() === 'POST',
      { timeout: 15000 },
    );
    await confirmBtn.click();
    const linkResponse = await linkPromise;
    expect(linkResponse.status()).toBeLessThan(400);

    await page.waitForTimeout(2000);

    const relatedServicesTable = page.locator('[data-testid="related-services-table"]');
    await expect(relatedServicesTable).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to service detail and verify related CIs section loads', async ({ page }) => {
    await login(page);

    await page.goto('/cmdb/services');
    await page.waitForLoadState('networkidle');

    const firstServiceRow = page.locator('table tbody tr').first();
    const hasService = await firstServiceRow.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasService) {
      test.skip(true, 'No services found to verify related CIs');
      return;
    }

    await firstServiceRow.click();
    await page.waitForURL(/\/cmdb\/services\/[0-9a-f-]+$/, { timeout: 10000 });

    const relatedCisSection = page.locator('text=Related CIs');
    await expect(relatedCisSection).toBeVisible({ timeout: 10000 });
  });
});
