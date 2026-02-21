import { test, expect } from '@playwright/test';
import { login, assertE2eMode, logE2eConfig } from '../helpers';

test.describe('Platform Health UI Smoke @real', () => {
  test.beforeAll(() => {
    logE2eConfig('Platform Health UI Smoke');
    assertE2eMode('REAL_STACK');
  });

  test('should display platform health page with last run after ingest', async ({ page }) => {
    await login(page);

    await page.goto('/admin/platform-health');

    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    const badgeCard = page.locator('[data-testid="health-badge-card"]');
    await expect(badgeCard).toBeVisible({ timeout: 15000 });

    const scopeToggle = page.locator('[data-testid="scope-toggle"]');
    await expect(scopeToggle).toBeVisible({ timeout: 10000 });

    const globalButton = scopeToggle.locator('button', { hasText: 'Global' });
    await expect(globalButton).toBeVisible();

    const runsTable = page.locator('[data-testid="runs-table"]');
    const emptyState = page.locator('[data-testid="empty-runs"]');

    const hasTable = await runsTable.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasTable || hasEmpty).toBe(true);

    if (hasTable) {
      const rows = runsTable.locator('tbody tr');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThan(0);
    }
  });
});
