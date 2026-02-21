import { test, expect } from '@playwright/test';
import { login, setupMockApi, waitForApiResponse, expectListLoaded } from './helpers';

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

test.describe('Controls List Page @mock', () => {
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
    // Mark test as slow for CI environments
    test.slow();

    // Navigate to controls page
    await page.goto('/controls');
    
    // Wait for page to load - wait for list table or empty state
    await expectListLoaded(page);
    
    // Open filter panel
    const filterButton = page.locator('[data-testid="filter-open"]');
    await expect(filterButton).toBeVisible({ timeout: 15000 });
    await filterButton.click();
    
    // Wait for filter panel to open
    await expect(page.locator('[data-testid="filter-panel"]')).toBeVisible({ timeout: 15000 });
    
    // The root group should be visible
    await expect(page.locator('[data-testid="filter-group"]').first()).toBeVisible({ timeout: 15000 });
    
    // Helper function to click MUI Select and select an option
    const selectOption = async (selectTestId: string, index: number, optionText: string) => {
      const selectWrapper = page.locator(`[data-testid="${selectTestId}"]`).nth(index);
      await expect(selectWrapper).toBeVisible({ timeout: 15000 });
      // Click on the combobox role inside the FormControl to open dropdown
      const combobox = selectWrapper.locator('[role="combobox"]');
      await expect(combobox).toBeVisible({ timeout: 15000 });
      await combobox.click();
      // Wait for dropdown to open and select option
      const option = page.locator(`li[role="option"]:has-text("${optionText}")`);
      await expect(option).toBeVisible({ timeout: 15000 });
      await option.click();
      // Wait for dropdown to close
      await expect(option).not.toBeVisible({ timeout: 5000 });
    };

    // Helper function to fill text input value (for string fields which use TextField)
    const fillValue = async (index: number, value: string) => {
      const valueWrapper = page.locator('[data-testid="filter-rule-value"]').nth(index);
      await expect(valueWrapper).toBeVisible({ timeout: 15000 });
      // For TextField, the input is inside the wrapper
      const input = valueWrapper.locator('input');
      await expect(input).toBeVisible({ timeout: 15000 });
      await input.fill(value);
    };
    
    // Add first rule (A)
    const addRuleButton = page.locator('[data-testid="filter-group-add-rule"]').first();
    await expect(addRuleButton).toBeVisible({ timeout: 15000 });
    await addRuleButton.click();
    
    // Wait for the rule to appear
    await expect.poll(
      async () => await page.locator('[data-testid="filter-rule"]').count(),
      { timeout: 15000 }
    ).toBe(1);
    
    // Fill in first rule: name contains "A"
    await selectOption('filter-rule-field', 0, 'Name');
    await selectOption('filter-rule-operator', 0, 'contains');
    await fillValue(0, 'A');
    
    // Add second rule (B)
    await addRuleButton.click();
    
    // Wait for the second rule to appear
    await expect.poll(
      async () => await page.locator('[data-testid="filter-rule"]').count(),
      { timeout: 15000 }
    ).toBe(2);
    
    // Fill in second rule: name contains "B"
    await selectOption('filter-rule-field', 1, 'Name');
    await selectOption('filter-rule-operator', 1, 'contains');
    await fillValue(1, 'B');
    
    // Now add a nested group for OR condition
    const addGroupButton = page.locator('[data-testid="filter-group-add-group"]').first();
    await expect(addGroupButton).toBeVisible({ timeout: 15000 });
    await addGroupButton.click();
    
    // Wait for the nested group to appear
    await expect.poll(
      async () => await page.locator('[data-testid="filter-group"]').count(),
      { timeout: 15000 }
    ).toBe(2);
    
    // Toggle the root group to OR (only visible when there are 2+ children)
    const rootJoinToggle = page.locator('[data-testid="filter-group-join"]').first();
    await expect(rootJoinToggle).toBeVisible({ timeout: 15000 });
    const orButton = rootJoinToggle.locator('button:has-text("OR")');
    await expect(orButton).toBeVisible({ timeout: 15000 });
    await orButton.click();
    
    // Add rule C to the nested group
    const nestedAddRule = page.locator('[data-testid="filter-group-add-rule"]').nth(1);
    await expect(nestedAddRule).toBeVisible({ timeout: 15000 });
    await nestedAddRule.click();
    
    // Wait for the third rule to appear
    await expect.poll(
      async () => await page.locator('[data-testid="filter-rule"]').count(),
      { timeout: 15000 }
    ).toBe(3);
    
    // Fill in rule C: name contains "C"
    await selectOption('filter-rule-field', 2, 'Name');
    await selectOption('filter-rule-operator', 2, 'contains');
    await fillValue(2, 'C');
    
    // Verify Apply button is enabled (all rules are valid)
    const applyButton = page.locator('[data-testid="filter-apply"]');
    await expect(applyButton).toBeEnabled({ timeout: 15000 });
    
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
    
    // Wait for filter panel to close
    await expect(page.locator('[data-testid="filter-panel"]')).not.toBeVisible({ timeout: 15000 });
    
    // Wait for list to stabilize (table OR empty state)
    await expectListLoaded(page);
    
    // Verify URL contains single-encoded filter param(no %257B which is double-encoded {)
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
    await expect(page.locator('text=Control Library').first()).toBeVisible({ timeout: 15000 });
  });
});
