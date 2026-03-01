/**
 * ITSM Incidents List – Advanced Filter (MOCK_UI)
 *
 * Smoke test for filter standardization v1:
 * - Opens ITSM Incidents list
 * - Opens Advanced Filter, applies a filter (e.g. priority = High or company = Niles Demo Customer)
 * - Asserts URL contains filter= (single-encoded)
 * - Asserts list request was made with expected query param(s)
 *
 * Must run with E2E_MODE=MOCK_UI (route-intercepted); no real backend required.
 */

import { test, expect } from '@playwright/test';
import { getE2eMode, setupMockApi } from '../helpers';
import { login } from '../helpers';

test.describe('ITSM Incidents list advanced filter @mock-ui', () => {
  test.beforeEach(async ({ page }) => {
    if (getE2eMode() !== 'MOCK_UI') {
      test.skip(true, 'Requires E2E_MODE=MOCK_UI');
      return;
    }
    await setupMockApi(page);
    await login(page);
  });

  test('applying advanced filter updates URL with single-encoded filter= and list request has query params', async ({
    page,
  }) => {
    const listRequests: { url: string }[] = [];
    page.on('request', (req) => {
      const u = req.url();
      if (u.includes('/grc/itsm/incidents') && req.method() === 'GET' && !u.match(/\/grc\/itsm\/incidents\/[^/]+$/)) {
        listRequests.push({ url: u });
      }
    });

    await page.goto('/itsm/incidents');
    await expect(page.locator('[data-testid="itsm-incident-list"]')).toBeVisible({ timeout: 15000 });

    // Open Advanced Filter
    await page.getByTestId('filter-open').click();
    await expect(page.getByTestId('filter-panel')).toBeVisible({ timeout: 5000 });

    // Add condition: Priority is P2 (High)
    const fieldSelect = page.getByTestId('filter-rule-field').first();
    await fieldSelect.click();
    await page.getByRole('option', { name: 'Priority' }).click();
    const operatorSelect = page.getByTestId('filter-rule-operator').first();
    await operatorSelect.click();
    await page.getByRole('option', { name: 'is' }).click();
    const valueSelect = page.getByTestId('filter-rule-value').first();
    await valueSelect.click();
    await page.getByRole('option', { name: /P2 - High/i }).click();

    // Apply filter
    await page.getByTestId('filter-apply').click();
    await expect(page.getByTestId('filter-panel')).not.toBeVisible();

    // URL should contain filter= with single-encoded JSON (no double-encoding %257B)
    await expect(page).toHaveURL(/\/itsm\/incidents/);
    const url = page.url();
    expect(url).toContain('filter=');
    expect(url).not.toContain('%257B');
    expect(url).not.toContain('%257D');

    // List request should have been sent with priority or filter param
    await page.waitForTimeout(500);
    const lastListReq = listRequests[listRequests.length - 1];
    expect(lastListReq).toBeDefined();
    expect(lastListReq!.url).toMatch(/priority=p2|filter=/);
  });
});
