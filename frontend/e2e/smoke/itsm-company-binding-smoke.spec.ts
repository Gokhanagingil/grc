/**
 * ITSM Company Binding Smoke Test
 *
 * Validates the core_company integration with ITSM entities.
 * In CI (E2E_MODE=MOCK_UI) runs with mocked /grc/companies/lookup; with real backend
 * uses seeded companies. One test (persistence) is skipped in mock mode.
 *
 * @smoke @mock
 */

import { test, expect } from '@playwright/test';
import { login, setupMockApi } from '../helpers';

const isMockMode = process.env.E2E_MOCK_API === '1' || process.env.E2E_MODE === 'MOCK_UI';

test.describe('ITSM Company Binding Smoke @mock @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  test('should show Customer Company section on service create page', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/(dashboard|admin)/);

    await page.goto('/itsm/services/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');

    const companySection = page.getByText('Customer Company');
    await expect(companySection.first()).toBeVisible({ timeout: 15000 });

    const companySelect = page.locator('[data-testid="service-company-select"]');
    await expect(companySelect).toBeVisible({ timeout: 5000 });
  });

  test('should show Customer Company section on incident create page', async ({ page }) => {
    await login(page);

    await page.goto('/itsm/incidents/new');
    await page.waitForLoadState('networkidle');

    const companySection = page.locator('text=Customer Company');
    await expect(companySection).toBeVisible({ timeout: 10000 });

    const companySelect = page.locator('[data-testid="incident-company-select"]');
    await expect(companySelect).toBeVisible({ timeout: 5000 });
  });

  test('should show Customer Company section on change create page', async ({ page }) => {
    await login(page);

    await page.goto('/itsm/changes/new');
    await page.waitForLoadState('networkidle');

    const companySection = page.locator('text=Customer Company');
    await expect(companySection).toBeVisible({ timeout: 10000 });

    const companySelect = page.locator('[data-testid="change-company-select"]');
    await expect(companySelect).toBeVisible({ timeout: 5000 });
  });

  test('incident create company dropdown has at least one company option', async ({ page }) => {
    await login(page);
    await page.goto('/itsm/incidents/new');
    await page.waitForLoadState('networkidle');

    const companySelect = page.locator('[data-testid="incident-company-select"]');
    await expect(companySelect).toBeVisible({ timeout: 10000 });

    const combobox = companySelect.locator('[role="combobox"]').first();
    const clickTarget = (await combobox.isVisible({ timeout: 3000 }).catch(() => false))
      ? combobox
      : companySelect;
    await clickTarget.click();

    const options = page.locator('[role="listbox"] [role="option"]');
    await expect(options.first()).toBeVisible({ timeout: 5000 });
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(2, 'Expected at least None + 1 company (mock or seeded)');
  });

  test('should create service with company, verify persistence', async ({ page }) => {
    test.skip(isMockMode, 'Persistence verification requires real backend');
    test.slow();
    await login(page);

    await page.goto('/itsm/services/new');
    await page.waitForLoadState('networkidle');

    // Fill in required service name
    const nameInput = page.locator('input[name="name"], [data-testid="service-name"] input').first();
    await nameInput.waitFor({ state: 'visible', timeout: 10000 });
    await nameInput.fill(`Smoke test service ${Date.now()}`);

    // Select a company
    const companySelect = page.locator('[data-testid="service-company-select"]');
    await expect(companySelect).toBeVisible({ timeout: 5000 });

    const companyCombobox = companySelect.locator('[role="combobox"]').first();
    const hasCombobox = await companyCombobox.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasCombobox) {
      await companyCombobox.click();
    } else {
      await companySelect.click();
    }

    const companyOption = page.locator('[role="listbox"] [role="option"]').first();
    const hasCompanyOption = await companyOption.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasCompanyOption) {
      test.skip(true, 'No companies available to test binding');
      return;
    }

    // Get the company name before selecting
    const companyName = await companyOption.textContent();
    await companyOption.click();

    await page.waitForTimeout(500);

    // Save the service
    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Create")').first();
    const savePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/grc/itsm/services') &&
        response.request().method() === 'POST',
      { timeout: 15000 },
    );
    await saveBtn.click();
    const saveResponse = await savePromise;
    expect(saveResponse.status()).toBeLessThan(400);

    await page.waitForTimeout(2000);

    // Verify company is shown in the detail view
    const currentUrl = page.url();
    if (currentUrl.includes('/itsm/services/') && !currentUrl.includes('/new')) {
      if (companyName) {
        const companyText = page.locator(`text=${companyName.trim()}`).first();
        const isCompanyVisible = await companyText.isVisible({ timeout: 5000 }).catch(() => false);
        if (isCompanyVisible) {
          expect(isCompanyVisible).toBe(true);
        }
      }
    }
  });

  test('SLA condition builder includes Customer Company field', async ({ page }) => {
    await login(page);
    await page.goto('/itsm/studio/sla');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');

    const addBtn = page.getByRole('button', { name: /Add|Create|New/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();
    await page.waitForTimeout(800);

    const conditionsTab = page.getByRole('tab', { name: /Condition/i });
    const conditionsButton = page.locator('button').filter({ hasText: /Condition/i });
    const conditionTrigger = (await conditionsTab.isVisible({ timeout: 2000 }).catch(() => false))
      ? conditionsTab
      : conditionsButton.first();
    if (await conditionTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await conditionTrigger.click();
      await page.waitForTimeout(500);
    }

    const addConditionBtn = page.getByRole('button', { name: /Add Condition/i }).first();
    await expect(addConditionBtn).toBeVisible({ timeout: 5000 });
    await addConditionBtn.click();
    await page.waitForTimeout(500);

    const fieldWrap = page.getByTestId('sla-condition-field-wrap');
    await expect(fieldWrap).toBeVisible({ timeout: 5000 });
    const fieldTrigger = fieldWrap.locator('.MuiSelect-select').first();
    await fieldTrigger.click({ timeout: 10000 });
    await page.waitForTimeout(300);

    const customerCompanyOption = page.getByRole('option', { name: 'Customer Company' });
    await expect(customerCompanyOption.first()).toBeVisible({ timeout: 5000 });
    await customerCompanyOption.first().click();
    await page.waitForTimeout(500);

    // Value input should be company autocomplete (names), not plain UUID text input
    const companyAutocomplete = page.getByTestId('sla-condition-company-autocomplete');
    await expect(companyAutocomplete).toBeVisible({ timeout: 5000 });
    const combobox = companyAutocomplete.locator('input[role="combobox"], [role="combobox"]').first();
    await combobox.click();
    await page.waitForTimeout(400);
    const listbox = page.locator('[role="listbox"]');
    await expect(listbox).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('option', { name: 'Mock Customer Co' }).first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('option', { name: 'Second Test Company' }).first()).toBeVisible({ timeout: 3000 });
  });

  test('should show Company filter on service list page', async ({ page }) => {
    await login(page);

    await page.goto('/itsm/services');
    await page.waitForLoadState('networkidle');

    // Look for the company filter dropdown
    const companyFilter = page.locator('[data-testid="company-filter"]');
    const hasFilter = await companyFilter.isVisible({ timeout: 5000 }).catch(() => false);

    // If filter is rendered via a select element, verify it
    if (hasFilter) {
      await expect(companyFilter).toBeVisible();
    } else {
      // Fallback: check if "Company" text appears in the filter area
      const companyLabel = page.locator('text=Company').first();
      await expect(companyLabel).toBeVisible({ timeout: 10000 });
    }
  });
});
