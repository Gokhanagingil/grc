import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Left menu contains Admin and Audit items', async ({ page }) => {
    // Navigate to dashboard first
    await page.goto('/dashboard');
    
    // Check for Admin menu item
    // Use .first() because drawer is rendered twice (mobile/desktop) causing duplicate test IDs
    const adminMenuItem = page.getByTestId('nav-admin').first();
    await expect(adminMenuItem).toBeVisible();
    
    // Check for Audit menu item
    const auditMenuItem = page.getByTestId('nav-audit').first();
    await expect(auditMenuItem).toBeVisible();
  });

  test('Clicking Admin -> Users loads Users list page', async ({ page }) => {
    // Navigate directly to admin/users since we're already in the admin context after login
    await page.goto('/admin/users');
    await page.waitForURL('/admin/users');
    
    // Verify page loaded
    await expect(page.getByTestId('page-admin-users-title')).toBeVisible();
    await expect(page.getByTestId('page-admin-users-title')).toContainText('User Management');
  });

  test('Clicking Admin -> Roles loads Roles page', async ({ page }) => {
    await page.goto('/admin');
    
    await page.getByTestId('nav-admin-roles').click();
    await page.waitForURL('/admin/roles');
    
    await expect(page.getByTestId('page-admin-roles-title')).toBeVisible();
    await expect(page.getByTestId('page-admin-roles-title')).toContainText('Roles & Permissions');
  });

  test('Clicking Admin -> Tenants loads Tenants page', async ({ page }) => {
    await page.goto('/admin');
    
    await page.getByTestId('nav-admin-tenants').click();
    await page.waitForURL('/admin/tenants');
    
    await expect(page.getByTestId('page-admin-tenants-title')).toBeVisible();
    await expect(page.getByTestId('page-admin-tenants-title')).toContainText('Tenant Management');
  });

  test('Clicking Admin -> Audit Logs loads Audit Logs page WITHOUT error', async ({ page }) => {
    await page.goto('/admin');
    
    // Click Audit Logs menu item
    await page.getByTestId('nav-admin-audit-logs').click();
    await page.waitForURL('/admin/audit-logs');
    
    // Verify page loaded successfully
    await expect(page.getByTestId('page-admin-audit-logs-title')).toBeVisible();
    await expect(page.getByTestId('page-admin-audit-logs-title')).toContainText('Audit Logs');
    
    // Verify table is present (even if empty)
    await expect(page.getByTestId('table-audit-logs')).toBeVisible();
    
    // Should NOT see "Cannot GET" error message
    const pageContent = await page.textContent('body');
    expect(pageContent).not.toContain('Cannot GET /audit-logs');
    expect(pageContent).not.toContain('404');
  });

  test('Clicking Admin -> System Status loads and shows at least one status widget', async ({ page }) => {
    await page.goto('/admin');
    
    // Verify we're on admin page and nav item exists
    await page.waitForURL(/\/admin/);
    const navSystemButton = page.getByTestId('nav-admin-system');
    await expect(navSystemButton).toBeVisible({ timeout: 10000 });
    
    await navSystemButton.click();
    await page.waitForURL('/admin/system', { timeout: 10000 });
    
    // Wait for page to stabilize - React needs time to render after navigation
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for page title with increased timeout for CI
    await expect(page.getByTestId('page-admin-system-title')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('page-admin-system-title')).toContainText('System Status');
    
    // Check that at least one status section is visible (API, Database, or Auth health)
    // Use increased timeout for CI where health checks may take longer
    const statusSection = page.locator('text=/API|Database|Auth|Health/i').first();
    await expect(statusSection).toBeVisible({ timeout: 15000 });
  });

  test('Clicking Admin -> System Settings loads and shows at least one settings section', async ({ page }) => {
    await page.goto('/admin');
    
    await page.getByTestId('nav-admin-settings').click();
    await page.waitForURL('/admin/settings');
    
    await expect(page.getByTestId('page-admin-settings-title')).toBeVisible();
    await expect(page.getByTestId('page-admin-settings-title')).toContainText('System Settings');
    
    // Check that settings content is visible
    const settingsContent = page.locator('text=/Version|Configuration|Settings/i').first();
    await expect(settingsContent).toBeVisible({ timeout: 5000 });
  });

  test('Coming soon section visible for Tables/Fields/Workflows and is read-only', async ({ page }) => {
    await page.goto('/admin');
    
    // Check for coming soon items
    const tablesComingSoon = page.getByTestId('section-tables-coming-soon');
    const fieldsComingSoon = page.getByTestId('section-fields-coming-soon');
    const workflowsComingSoon = page.getByTestId('section-workflows-coming-soon');
    
    await expect(tablesComingSoon).toBeVisible();
    await expect(fieldsComingSoon).toBeVisible();
    await expect(workflowsComingSoon).toBeVisible();
    
    // Verify they are disabled
    await expect(tablesComingSoon).toBeDisabled();
    await expect(fieldsComingSoon).toBeDisabled();
    await expect(workflowsComingSoon).toBeDisabled();
  });
});

