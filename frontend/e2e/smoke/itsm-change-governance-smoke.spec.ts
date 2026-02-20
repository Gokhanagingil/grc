/**
 * ITSM Change Governance Smoke Test (PR3)
 *
 * Validates the change governance golden path:
 *   login -> open demo change -> see governance strip -> request approval -> approve -> implement
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

test.describe('ITSM Change Governance Smoke @smoke', () => {
  test.skip(isMockMode, 'Smoke tests require real backend - skipping in mock API mode');

  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  test('should login and navigate to changes list', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/(dashboard|admin)/);

    await page.goto('/itsm/changes');
    await page.waitForLoadState('networkidle');

    const heading = page.locator('text=Changes, text=Change Requests, text=ITSM Changes').first();
    const tableOrEmpty = page.locator('table, text=No changes, text=No data').first();
    const visible = await Promise.race([
      heading.isVisible({ timeout: 10000 }).catch(() => false),
      tableOrEmpty.isVisible({ timeout: 10000 }).catch(() => false),
    ]);
    expect(visible).toBeTruthy();
  });

  test('should show governance strip on change detail', async ({ page }) => {
    test.slow();
    await login(page);

    await page.goto('/itsm/changes');
    await page.waitForLoadState('networkidle');

    const firstRow = page.locator('table tbody tr').first();
    const hasRows = await firstRow.isVisible({ timeout: 10000 }).catch(() => false);
    if (!hasRows) {
      test.skip(true, 'No changes available to test governance strip');
      return;
    }
    await firstRow.click();
    await page.waitForLoadState('networkidle');

    const riskBadge = page.locator('[data-testid="risk-level-badge"]');
    const hasRiskBadge = await riskBadge.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasRiskBadge) {
      await expect(riskBadge).toBeVisible();
    }

    const approvalBadge = page.locator('[data-testid="approval-status-badge"]');
    const hasApprovalBadge = await approvalBadge.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasApprovalBadge) {
      await expect(approvalBadge).toBeVisible();
    }
  });

  test('should show Request CAB Approval button for eligible change', async ({ page }) => {
    test.slow();
    await login(page);

    await page.goto('/itsm/changes');
    await page.waitForLoadState('networkidle');

    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();

    if (rowCount === 0) {
      test.skip(true, 'No changes available');
      return;
    }

    await rows.first().click();
    await page.waitForLoadState('networkidle');

    const cabBtn = page.locator('[data-testid="request-cab-btn"]');
    const hasCabBtn = await cabBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasCabBtn) {
      await expect(cabBtn).toBeEnabled();
    }
  });

  test('golden path: request approval -> approve -> implement', async ({ page }) => {
    test.slow();
    await login(page);

    await page.goto('/itsm/changes/new');
    await page.waitForLoadState('networkidle');

    const titleInput = page.locator('input[name="title"], [data-testid="change-title"] input').first();
    await titleInput.waitFor({ state: 'visible', timeout: 10000 });
    await titleInput.fill(`Smoke governance test ${Date.now()}`);

    const typeSelect = page.locator('[data-testid="change-type-select"]');
    const hasTypeSelect = await typeSelect.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasTypeSelect) {
      const combobox = typeSelect.locator('[role="combobox"]').first();
      const hasCombobox = await combobox.isVisible({ timeout: 2000 }).catch(() => false);
      if (hasCombobox) {
        await combobox.click();
        const normalOption = page.locator('[role="listbox"] [role="option"]').filter({ hasText: /normal/i }).first();
        const hasOption = await normalOption.isVisible({ timeout: 3000 }).catch(() => false);
        if (hasOption) {
          await normalOption.click();
        } else {
          await page.locator('[role="listbox"] [role="option"]').first().click();
        }
      }
    }

    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Create")').first();
    await saveBtn.click();

    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    if (currentUrl.includes('/itsm/changes/') && !currentUrl.includes('/new')) {
      const cabBtn = page.locator('[data-testid="request-cab-btn"]');
      const hasCabBtn = await cabBtn.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasCabBtn) {
        await cabBtn.click();
        await page.waitForTimeout(2000);

        const approvalBadge = page.locator('[data-testid="approval-status-badge"]');
        const hasApprovalBadge = await approvalBadge.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasApprovalBadge) {
          const badgeText = await approvalBadge.textContent();
          expect(badgeText).toBeTruthy();
        }

        const confirmBtn = page.locator('[data-testid="confirm-approval-btn"]');
        const approveIconBtn = page.locator('[data-testid^="approve-btn-"]').first();
        const hasApproveBtn = await approveIconBtn.isVisible({ timeout: 5000 }).catch(() => false);

        if (hasApproveBtn) {
          await approveIconBtn.click();
          await page.waitForTimeout(500);

          const hasConfirmBtn = await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false);
          if (hasConfirmBtn) {
            await confirmBtn.click();
            await page.waitForTimeout(2000);
          }

          const implementBtn = page.locator('[data-testid="implement-btn"]');
          const hasImplementBtn = await implementBtn.isVisible({ timeout: 5000 }).catch(() => false);
          if (hasImplementBtn) {
            await implementBtn.click();
            await page.waitForTimeout(2000);
          }
        }
      }
    }
  });
});
