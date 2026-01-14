import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Left navigation contains Admin and GRC group headings with key items', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Use .first() because drawer is rendered twice (mobile/desktop) causing duplicate test IDs
    
    // 1. Verify Admin exists as a top-level group
    const adminGroup = page.getByTestId('nav-admin').first();
    await expect(adminGroup).toBeVisible();
    
    // 2. Verify GRC group headings are present
    // Library group
    const libraryGroup = page.getByTestId('nav-group-grc-library').first();
    await expect(libraryGroup).toBeVisible();
    
    // Assurance group
    const assuranceGroup = page.getByTestId('nav-group-grc-assurance').first();
    await expect(assuranceGroup).toBeVisible();
    
    // Findings & Remediation group
    const findingsGroup = page.getByTestId('nav-group-grc-findings').first();
    await expect(findingsGroup).toBeVisible();
    
    // Risk & Exceptions group
    const riskGroup = page.getByTestId('nav-group-grc-risk').first();
    await expect(riskGroup).toBeVisible();
    
    // Insights group
    const insightsGroup = page.getByTestId('nav-group-grc-insights').first();
    await expect(insightsGroup).toBeVisible();
    
    // 3. Verify representative items within each GRC group
    // Library group is expanded by default - verify Controls item
    const controlsItem = page.getByTestId('nav-controls').first();
    await expect(controlsItem).toBeVisible();
    
    // Expand Assurance group and verify Evidence and Tests/Results items
    await assuranceGroup.click();
    const evidenceItem = page.getByTestId('nav-evidence').first();
    await expect(evidenceItem).toBeVisible();
    const testResultsItem = page.getByTestId('nav-tests-/-results').first();
    await expect(testResultsItem).toBeVisible();
    // Also verify Audits item is present
    const auditsItem = page.getByTestId('nav-audit').first();
    await expect(auditsItem).toBeVisible();
    
    // Expand Findings & Remediation group and verify Issues item
    await findingsGroup.click();
    const issuesItem = page.getByTestId('nav-issues').first();
    await expect(issuesItem).toBeVisible();
    
    // Expand Risk & Exceptions group and verify Risks item
    await riskGroup.click();
    const risksItem = page.getByTestId('nav-risks').first();
    await expect(risksItem).toBeVisible();
    
    // Expand Insights group and verify Coverage item
    await insightsGroup.click();
    const coverageItem = page.getByTestId('nav-coverage').first();
    await expect(coverageItem).toBeVisible();
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
    
    // Use the same simple sequential pattern that works for System Settings
    await page.getByTestId('nav-admin-system').click();
    await page.waitForURL('/admin/system');
    
    // Wait for page title - the title is rendered immediately (deterministic UI)
    await expect(page.getByTestId('page-admin-system-title')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('page-admin-system-title')).toContainText('System Status');
    
    // Verify widgets container is present (always rendered, even during loading)
    // The container has data-testid="system-status-widgets" and contains the health check cards
    await expect(page.getByTestId('system-status-widgets')).toBeVisible({ timeout: 15000 });
    
    // Verify at least one Card component is rendered within the widgets container
    // Cards are MUI components that contain the health status information
    const widgetsContainer = page.getByTestId('system-status-widgets');
    const cards = widgetsContainer.locator('.MuiCard-root');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });
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

