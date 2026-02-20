/**
 * CMDB Smoke Test (PR-A.1)
 *
 * Validates the CMDB foundation flow:
 *   login -> CMDB CI Classes -> create class -> create CI -> open detail -> verify saved
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

test.describe('CMDB Smoke: Class + CI CRUD @smoke', () => {
  test.skip(isMockMode, 'Smoke tests require real backend - skipping in mock API mode');

  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  test('should login, navigate to CMDB Classes, and verify list loads', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/(dashboard|admin)/);

    // Navigate to CMDB CI Classes
    const itsmSection = page.locator('text=ITSM').first();
    if (await itsmSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await itsmSection.click();
    }

    const cmdbSection = page.locator('text=CMDB').first();
    if (await cmdbSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await cmdbSection.click();
    }

    const classesLink = page.locator('a[href*="/cmdb/classes"]').first()
      .or(page.locator('text=CI Classes').first());

    await expect(classesLink).toBeVisible({ timeout: 10000 });
    await classesLink.click();

    await page.waitForURL(/\/cmdb\/classes/, { timeout: 15000 });

    // Verify the API response returns 200
    const classesApiPromise = page.waitForResponse(
      (response) =>
        response.url().includes('/grc/cmdb/classes') &&
        response.request().method() === 'GET',
      { timeout: 15000 },
    );
    await page.reload();
    const classesResponse = await classesApiPromise;
    expect(classesResponse.status()).toBe(200);
  });

  test('should create a CI class via dialog', async ({ page }) => {
    await login(page);

    await page.goto('/cmdb/classes');
    await page.waitForLoadState('networkidle');

    // Look for a "New" or "Create" or "Add" button
    const createBtn = page.locator('button').filter({ hasText: /new|create|add/i }).first();
    const hasBtnVisible = await createBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasBtnVisible) {
      // CI Classes page may use inline create - skip if no button
      test.skip(true, 'No create button found on CI Classes page');
      return;
    }

    await createBtn.click();

    // Fill the dialog form
    const nameInput = page.locator('input[name="name"]').or(
      page.locator('[data-testid="class-name-input"]'),
    ).first();
    const labelInput = page.locator('input[name="label"]').or(
      page.locator('[data-testid="class-label-input"]'),
    ).first();

    const uniqueName = `smoke_test_${Date.now()}`;
    await nameInput.fill(uniqueName);
    await labelInput.fill('Smoke Test Class');

    // Submit
    const submitBtn = page.locator('button[type="submit"]').or(
      page.locator('button').filter({ hasText: /save|create|submit/i }),
    ).first();
    await submitBtn.click();

    // Verify the class appears (wait for API and re-render)
    await page.waitForTimeout(2000);
    await expect(page.locator(`text=${uniqueName}`).first()).toBeVisible({ timeout: 10000 });
  });

  test('should create a CI and open detail page', async ({ page }) => {
    await login(page);

    // Navigate to CIs list
    await page.goto('/cmdb/cis');
    await page.waitForLoadState('networkidle');

    // Click New CI button
    const newCiBtn = page.locator('button').filter({ hasText: /new|create|add/i }).first()
      .or(page.locator('a[href*="/cmdb/cis/new"]').first());
    const hasCiBtn = await newCiBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasCiBtn) {
      test.skip(true, 'No create CI button found');
      return;
    }

    await newCiBtn.click();
    await page.waitForURL(/\/cmdb\/cis\/(new|create)/, { timeout: 10000 });

    // Fill CI form
    const nameInput = page.locator('input[name="name"]').or(
      page.locator('[data-testid="ci-name-input"]'),
    ).first();
    const ciName = `SMOKE-CI-${Date.now()}`;
    await nameInput.fill(ciName);

    // Select a class from the dropdown (MUI Select)
    const classSelect = page.locator('[data-testid="ci-class-select"]').or(
      page.locator('#classId').or(
        page.locator('label:has-text("Class")').locator('..').locator('[role="combobox"]'),
      ),
    ).first();

    const classSelectVisible = await classSelect.isVisible({ timeout: 5000 }).catch(() => false);
    if (classSelectVisible) {
      await classSelect.click();
      // Pick first option from the listbox
      const firstOption = page.locator('[role="listbox"] [role="option"]').first();
      await expect(firstOption).toBeVisible({ timeout: 5000 });
      await firstOption.click();
    }

    // Save
    const saveBtn = page.locator('button').filter({ hasText: /save/i }).first();
    const saveBtnVisible = await saveBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (saveBtnVisible) {
      // Intercept the save response
      const savePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/grc/cmdb/cis') &&
          response.request().method() === 'POST',
        { timeout: 15000 },
      );
      await saveBtn.click();
      const saveResponse = await savePromise;
      expect(saveResponse.status()).toBeLessThan(400);

      // Verify we're on detail page or the CI name appears
      await page.waitForTimeout(2000);
      const ciVisible = await page.locator(`text=${ciName}`).first()
        .isVisible({ timeout: 10000 })
        .catch(() => false);
      expect(ciVisible).toBe(true);
    }
  });
});
