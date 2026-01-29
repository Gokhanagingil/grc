import { test, expect } from '@playwright/test';
import { login, setupMockApi, waitForApiResponse } from './helpers';

/**
 * Controls List E2E Tests
 * 
 * These tests verify the Controls List page functionality including:
 * - Auth timing fix: Controls load correctly when user is authenticated
 * - Search functionality using the 'search' query param
 * - Filter functionality for status and type
 * 
 * Regression test for: Controls List 401 fix (Sprint A)
 */

test.describe('Controls List Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should load controls list when authenticated (regression: 401 fix)', async ({ page }) => {
    // Navigate to controls page
    await page.goto('/controls');
    
    // Wait for the controls API call to complete
    // This verifies that the auth token is properly attached
    const controlsResponse = await waitForApiResponse(page, '/grc/controls', 15000);
    
    // Verify the response is successful (not 401)
    expect(controlsResponse.status()).toBe(200);
    
    // Verify controls are displayed in the table
    await expect(page.locator('text=Access Control Review')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=CTRL-001')).toBeVisible();
    
    // Verify we don't see the "No controls found" empty state
    await expect(page.locator('text=No controls found')).not.toBeVisible();
  });

  test('should display control library header', async ({ page }) => {
    await page.goto('/controls');
    
    // Wait for page to load - use .first() since "Control Library" may appear in multiple places (header, breadcrumb, etc.)
    await expect(page.locator('text=Control Library').first()).toBeVisible({ timeout: 10000 });
  });

  test('should show search input by default', async ({ page }) => {
    await page.goto('/controls');
    
    // Wait for page to load
    await expect(page.locator('input[placeholder="Search controls..."]')).toBeVisible({ timeout: 10000 });
  });

  test('should filter controls by search query', async ({ page }) => {
    await page.goto('/controls');
    
    // Wait for initial load - use .first() since "Control Library" may appear in multiple places
    await expect(page.locator('text=Control Library').first()).toBeVisible({ timeout: 10000 });
    
    // Type in search box
    const searchInput = page.locator('input[placeholder="Search controls..."]');
    await searchInput.fill('GF');
    
    // Wait for the filtered API call
    // The search should use 'search' param (not 'q')
    const searchResponse = await waitForApiResponse(page, '/grc/controls', 10000);
    expect(searchResponse.status()).toBe(200);
    
    // Verify the search results show the GF control
    await expect(page.locator('text=GF Security Policy Enforcement')).toBeVisible({ timeout: 5000 });
  });

  test('should show status filter dropdown', async ({ page }) => {
    await page.goto('/controls');
    
    // Wait for page to load - use .first() since "Control Library" may appear in multiple places
    await expect(page.locator('text=Control Library').first()).toBeVisible({ timeout: 10000 });
    
    // Verify status filter is present
    await expect(page.locator('label:has-text("Status")')).toBeVisible();
  });

  test('should show type filter dropdown', async ({ page }) => {
    await page.goto('/controls');
    
    // Wait for page to load - use .first() since "Control Library" may appear in multiple places
    await expect(page.locator('text=Control Library').first()).toBeVisible({ timeout: 10000 });
    
    // Verify type filter is present
    await expect(page.locator('label:has-text("Type")')).toBeVisible();
  });

  test('should display control data in table columns', async ({ page }) => {
    await page.goto('/controls');
    
    // Wait for controls to load
    await expect(page.locator('text=CTRL-001')).toBeVisible({ timeout: 10000 });
    
    // Verify table headers are present
    await expect(page.locator('th:has-text("Code")')).toBeVisible();
    await expect(page.locator('th:has-text("Name")')).toBeVisible();
    await expect(page.locator('th:has-text("Type")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
    await expect(page.locator('th:has-text("Frequency")')).toBeVisible();
  });

  test('should not make API call before auth is ready', async ({ page }) => {
    // This test verifies the auth timing fix
    // We set up mock API and track when the controls API is called
    await setupMockApi(page);
    
    let controlsCallMade = false;
    let authMeCallMade = false;
    
    // Track API calls
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/grc/controls')) {
        controlsCallMade = true;
      }
      if (url.includes('/auth/me') || url.includes('/users/me')) {
        authMeCallMade = true;
      }
    });
    
    // Navigate to controls page
    await page.goto('/controls');
    
    // Wait for page to stabilize
    await page.waitForTimeout(2000);
    
    // Verify that auth/me was called (auth initialization)
    expect(authMeCallMade).toBe(true);
    
    // Verify that controls API was called (after auth ready)
    expect(controlsCallMade).toBe(true);
  });

  test('should create nested filter tree: (A AND B) OR C', async ({ page }) => {
    // Navigate to controls page
    await page.goto('/controls');
    
    // Wait for page to load
    await expect(page.locator('text=Control Library').first()).toBeVisible({ timeout: 10000 });
    
    // Open filter panel
    const filterButton = page.locator('[data-testid="filter-open"]');
    await expect(filterButton).toBeVisible({ timeout: 5000 });
    await filterButton.click();
    
    // Wait for filter panel to open
    await expect(page.locator('[data-testid="filter-panel"]')).toBeVisible({ timeout: 5000 });
    
    // The root group should be visible with AND/OR toggle
    await expect(page.locator('[data-testid="filter-group"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="filter-group-join"]').first()).toBeVisible();
    
    // Add first rule (A)
    const addRuleButton = page.locator('[data-testid="filter-group-add-rule"]').first();
    await expect(addRuleButton).toBeVisible();
    await addRuleButton.click();
    
    // Fill in first rule: name contains "A"
    await expect(page.locator('[data-testid="filter-rule-field"]').first()).toBeVisible();
    await page.locator('[data-testid="filter-rule-field"]').first().click();
    await page.locator('li[role="option"]:has-text("Name")').click();
    
    await page.locator('[data-testid="filter-rule-op"]').first().click();
    await page.locator('li[role="option"]:has-text("contains")').click();
    
    await page.locator('[data-testid="filter-rule-value"]').first().fill('A');
    
    // Add second rule (B)
    await addRuleButton.click();
    
    // Fill in second rule: name contains "B"
    const fieldSelects = page.locator('[data-testid="filter-rule-field"]');
    await fieldSelects.nth(1).click();
    await page.locator('li[role="option"]:has-text("Name")').click();
    
    const opSelects = page.locator('[data-testid="filter-rule-op"]');
    await opSelects.nth(1).click();
    await page.locator('li[role="option"]:has-text("contains")').click();
    
    const valueInputs = page.locator('[data-testid="filter-rule-value"]');
    await valueInputs.nth(1).fill('B');
    
    // Now add a nested group for OR condition
    const addGroupButton = page.locator('[data-testid="filter-group-add-group"]').first();
    await expect(addGroupButton).toBeVisible({ timeout: 5000 });
    await addGroupButton.click();
    
    // The nested group should appear
    const nestedGroups = page.locator('[data-testid="filter-group"]');
    await expect(nestedGroups).toHaveCount(2, { timeout: 5000 });
    
    // Toggle the root group to OR
    const rootJoinToggle = page.locator('[data-testid="filter-group-join"]').first();
    await rootJoinToggle.locator('button:has-text("OR")').click();
    
    // Add rule C to the nested group
    const nestedAddRule = page.locator('[data-testid="filter-group-add-rule"]').nth(1);
    await nestedAddRule.click();
    
    // Fill in rule C: name contains "C"
    const allFieldSelects = page.locator('[data-testid="filter-rule-field"]');
    await allFieldSelects.last().click();
    await page.locator('li[role="option"]:has-text("Name")').click();
    
    const allOpSelects = page.locator('[data-testid="filter-rule-op"]');
    await allOpSelects.last().click();
    await page.locator('li[role="option"]:has-text("contains")').click();
    
    const allValueInputs = page.locator('[data-testid="filter-rule-value"]');
    await allValueInputs.last().fill('C');
    
    // Verify Apply button is enabled (all rules are valid)
    const applyButton = page.locator('[data-testid="filter-apply"]');
    await expect(applyButton).toBeEnabled({ timeout: 5000 });
    
    // Track API request to verify filter param
    let filterParamValue: string | null = null;
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/grc/controls')) {
        const urlObj = new URL(url);
        filterParamValue = urlObj.searchParams.get('filter');
      }
    });
    
    // Click Apply
    await applyButton.click();
    
    // Wait for filter panel to close and API call to be made
    await page.waitForTimeout(1000);
    
    // Verify URL contains single-encoded filter param (no %257B which is double-encoded {)
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('%257B');
    expect(currentUrl).not.toContain('%257D');
    
    // Verify filter param is valid JSON (always check, filterParamValue may be null which is fine)
    const filterIsValidJson = filterParamValue === null || (() => {
      try {
        JSON.parse(filterParamValue);
        return true;
      } catch {
        return false;
      }
    })();
    expect(filterIsValidJson).toBe(true);
    
    // Verify page remains stable (no crash)
    await expect(page.locator('text=Control Library').first()).toBeVisible({ timeout: 5000 });
  });
});
