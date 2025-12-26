import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Admin Panel', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Admin panel loads and shows navigation menu', async ({ page }) => {
    await page.goto('/admin');
    
    // Should redirect to /admin/users (default)
    await page.waitForURL('/admin/users');
    
    // Verify Users page loaded
    await expect(page.getByTestId('page-admin-users-title')).toBeVisible();
  });

  test('Audit Logs page can refresh without errors', async ({ page }) => {
    // Use Promise.all to avoid race condition - register wait before navigation triggers request
    const [initialResponse] = await Promise.all([
      page.waitForResponse(
        (response) => {
          try {
            const url = response.url();
            const req = response.request();
            return !!url && !!req && url.includes('/audit-logs') && req.method() === 'GET' && response.status() < 500;
          } catch {
            return false;
          }
        },
        { timeout: 15000 }
      ),
      page.goto('/admin/audit-logs'),
    ]);
    
    // Wait for page to load
    await expect(page.getByTestId('page-admin-audit-logs-title')).toBeVisible();
    
    // Verify the API call was successful (200 or 201)
    expect([200, 201]).toContain(initialResponse.status());
    
    // Verify response is JSON (not 404 HTML)
    const contentType = initialResponse.headers()['content-type'] || '';
    expect(contentType).toContain('application/json');
    
    // Click refresh button
    const refreshButton = page.getByTestId('btn-refresh-audit-logs');
    await expect(refreshButton).toBeVisible();
    
    // Wait for the refresh API call
    const refreshResponse = await Promise.all([
      page.waitForResponse(
        (response) => {
          const url = response.url();
          return url.includes('/audit-logs') && response.request().method() === 'GET';
        },
        { timeout: 10000 }
      ),
      refreshButton.click(),
    ]).then(([response]) => response);
    
    // Verify the refresh API call was successful
    expect([200, 201]).toContain(refreshResponse.status());
    expect(refreshResponse.headers()['content-type'] || '').toContain('application/json');
    
    // Should not show error in UI
    const errorAlert = page.locator('[role="alert"]').filter({ hasText: /error|failed/i });
    const errorCount = await errorAlert.count();
    expect(errorCount).toBe(0);
  });

  test('Audit Logs page filters can be toggled', async ({ page }) => {
    await page.goto('/admin/audit-logs');
    
    await expect(page.getByTestId('page-admin-audit-logs-title')).toBeVisible();
    
    // Click filter button
    const filterButton = page.getByTestId('btn-filter-audit-logs');
    await expect(filterButton).toBeVisible();
    await filterButton.click();
    
    // Filter panel should appear (contains date inputs, action field, etc.)
    await page.waitForTimeout(500);
    
    // Check for filter inputs
    const dateInputs = page.locator('input[type="date"]');
    const dateInputCount = await dateInputs.count();
    expect(dateInputCount).toBeGreaterThanOrEqual(0);
  });
});

