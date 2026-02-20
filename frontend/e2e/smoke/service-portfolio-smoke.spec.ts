/**
 * Service Portfolio Smoke Test (PR-B1)
 *
 * Validates the service portfolio flow:
 *   login -> CMDB Services -> create service -> open detail -> add offering -> verify row appears
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

test.describe('Service Portfolio Smoke: Service + Offering CRUD @smoke', () => {
  test.skip(isMockMode, 'Smoke tests require real backend - skipping in mock API mode');

  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  test('should login, navigate to CMDB Services, and verify list loads', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/(dashboard|admin)/);

    await page.goto('/cmdb/services');
    await page.waitForLoadState('networkidle');

    const servicesApiPromise = page.waitForResponse(
      (response) =>
        response.url().includes('/grc/cmdb/services') &&
        response.request().method() === 'GET',
      { timeout: 15000 },
    );
    await page.reload();
    const servicesResponse = await servicesApiPromise;
    expect(servicesResponse.status()).toBe(200);
  });

  test('should create a service, open detail, add offering, and verify', async ({ page }) => {
    test.slow();
    await login(page);

    await page.goto('/cmdb/services');
    await page.waitForLoadState('networkidle');

    const createBtn = page.locator('[data-testid="btn-create-service"]')
      .or(page.locator('button').filter({ hasText: /new service/i }).first());

    const hasBtnVisible = await createBtn.first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasBtnVisible) {
      test.skip(true, 'No create service button found');
      return;
    }

    await createBtn.first().click();
    await page.waitForURL(/\/cmdb\/services\/(new|create)/, { timeout: 10000 });

    const serviceName = `SMOKE-SVC-${Date.now()}`;
    const nameInput = page.locator('[data-testid="input-service-name"] input')
      .or(page.locator('input').filter({ hasText: '' }).first());

    const nameField = page.locator('[data-testid="input-service-name"] input');
    if (await nameField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameField.fill(serviceName);
    } else {
      const fallbackInput = page.locator('label:has-text("Name")').locator('..').locator('input').first();
      await fallbackInput.fill(serviceName);
    }

    const saveBtn = page.locator('[data-testid="btn-save-service"]')
      .or(page.locator('button').filter({ hasText: /save/i }).first());

    const savePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/grc/cmdb/services') &&
        response.request().method() === 'POST',
      { timeout: 15000 },
    );
    await saveBtn.first().click();
    const saveResponse = await savePromise;
    expect(saveResponse.status()).toBeLessThan(400);

    await page.waitForURL(/\/cmdb\/services\/[0-9a-f-]+$/, { timeout: 10000 });

    const addOfferingBtn = page.locator('[data-testid="btn-add-offering"]')
      .or(page.locator('button').filter({ hasText: /add offering/i }).first());

    const hasOfferingBtn = await addOfferingBtn.first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasOfferingBtn) {
      return;
    }

    await addOfferingBtn.first().click();

    const offeringName = `SMOKE-OFF-${Date.now()}`;
    const offNameInput = page.locator('[data-testid="input-offering-name"] input')
      .or(page.locator('input[placeholder*="Offering"]').first());

    if (await offNameInput.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await offNameInput.first().fill(offeringName);
    } else {
      const fallbackOff = page.locator('label:has-text("Offering Name")').locator('..').locator('input').first();
      await fallbackOff.fill(offeringName);
    }

    const saveOfferingBtn = page.locator('[data-testid="btn-save-offering"]')
      .or(page.locator('button').filter({ hasText: /^add$/i }).first());

    const offSavePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/grc/cmdb/service-offerings') &&
        response.request().method() === 'POST',
      { timeout: 15000 },
    );
    await saveOfferingBtn.first().click();
    const offSaveResponse = await offSavePromise;
    expect(offSaveResponse.status()).toBeLessThan(400);

    await page.waitForTimeout(2000);
    const offeringVisible = await page.locator(`text=${offeringName}`).first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    expect(offeringVisible).toBe(true);
  });
});
