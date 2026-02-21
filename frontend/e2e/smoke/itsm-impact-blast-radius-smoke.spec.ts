/**
 * ITSM Impact & Blast Radius Smoke Test (PR-B4)
 *
 * Validates the incident impact tab flow:
 *   login -> open existing incident -> verify Impact section visible
 *   -> verify Affected CIs section -> verify Impacted Services widget
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

test.describe('ITSM Impact & Blast Radius Smoke @mock @smoke', () => {
  test.skip(isMockMode, 'Smoke tests require real backend - skipping in mock API mode');

  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  test('should show Impact & Blast Radius section on existing incident', async ({ page }) => {
    test.slow();
    await login(page);

    await page.goto('/itsm/incidents');
    await page.waitForLoadState('networkidle');

    const incidentRow = page.locator('table tbody tr').first();
    const hasIncident = await incidentRow.isVisible({ timeout: 10000 }).catch(() => false);

    if (!hasIncident) {
      await page.goto('/itsm/incidents/new');
      await page.waitForLoadState('networkidle');

      const shortDescInput = page.locator('input').first();
      await shortDescInput.waitFor({ state: 'visible', timeout: 10000 });
      await shortDescInput.fill(`Impact Smoke Test ${Date.now()}`);

      const saveBtn = page.locator('button:has-text("Save")').first();
      await saveBtn.click();
      await page.waitForTimeout(3000);
    } else {
      await incidentRow.click();
      await page.waitForLoadState('networkidle');
    }

    await page.waitForTimeout(2000);

    const impactSection = page.locator('[data-testid="incident-impact-tab"]');
    await expect(impactSection).toBeVisible({ timeout: 15000 });

    const affectedCisHeading = page.locator('text=Affected CIs');
    await expect(affectedCisHeading).toBeVisible({ timeout: 10000 });

    const addCiBtn = page.locator('[data-testid="add-affected-ci-btn"]');
    await expect(addCiBtn).toBeVisible({ timeout: 5000 });

    const impactedServicesHeading = page.locator('text=Impacted Services');
    await expect(impactedServicesHeading).toBeVisible({ timeout: 10000 });

    const impactedOfferingsHeading = page.locator('text=Impacted Offerings');
    await expect(impactedOfferingsHeading).toBeVisible({ timeout: 10000 });
  });

  test('should open Add Affected CI dialog', async ({ page }) => {
    test.slow();
    await login(page);

    await page.goto('/itsm/incidents');
    await page.waitForLoadState('networkidle');

    const incidentRow = page.locator('table tbody tr').first();
    const hasIncident = await incidentRow.isVisible({ timeout: 10000 }).catch(() => false);

    if (!hasIncident) {
      test.skip(true, 'No incidents available to test impact tab');
      return;
    }

    await incidentRow.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const addCiBtn = page.locator('[data-testid="add-affected-ci-btn"]');
    await expect(addCiBtn).toBeVisible({ timeout: 15000 });
    await addCiBtn.click();

    const dialog = page.locator('[data-testid="add-affected-ci-dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const ciAutocomplete = dialog.locator('[data-testid="ci-autocomplete"]');
    await expect(ciAutocomplete).toBeVisible({ timeout: 5000 });

    const relTypeSelect = dialog.locator('[data-testid="relationship-type-select"]');
    await expect(relTypeSelect).toBeVisible({ timeout: 5000 });

    const cancelBtn = dialog.locator('button:has-text("Cancel")');
    await cancelBtn.click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });
});
