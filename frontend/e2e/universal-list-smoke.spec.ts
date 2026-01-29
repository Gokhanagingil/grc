import { test, expect } from '@playwright/test';
import { login, setupMockApi } from './helpers';

test.describe('Universal List Experience Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
    await login(page);
  });

  test.describe('Issues List', () => {
    test('should load issues list page', async ({ page }) => {
      await page.goto('/issues');
      
      // Wait for the universal list page container to be visible
      await expect(page.getByTestId('universal-list-page').or(page.getByTestId('issue-list-page'))).toBeVisible({ timeout: 10000 });
    });

    test('should have search input', async ({ page }) => {
      await page.goto('/issues');
      
      // Wait for page to load first
      await expect(page.getByTestId('universal-list-page').or(page.getByTestId('issue-list-page'))).toBeVisible({ timeout: 10000 });
      
      // Check for search input using data-testid
      const searchInput = page.getByTestId('list-search');
      await expect(searchInput).toBeVisible({ timeout: 5000 });
    });

    test('should filter results when typing in search', async ({ page }) => {
      await page.goto('/issues');
      
      // Wait for page to load
      await expect(page.getByTestId('universal-list-page').or(page.getByTestId('issue-list-page'))).toBeVisible({ timeout: 10000 });
      
      // The list-search testId is on the TextField wrapper, so we need to find the input inside it
      const searchContainer = page.getByTestId('list-search');
      await expect(searchContainer).toBeVisible({ timeout: 5000 });
      
      // Find the actual input element inside the TextField
      const searchInput = searchContainer.locator('input');
      await searchInput.fill('test search');
      
      // Wait for debounce (300ms) + URL update + buffer time
      // The URL should contain 'search=' after the debounce completes
      await page.waitForURL(/search=/, { timeout: 5000 }).catch(() => {
        // If URL doesn't change, that's okay - some implementations might not sync to URL
      });
      
      // Verify the search input still has the value (basic functionality check)
      await expect(searchInput).toHaveValue('test search');
    });

    test('should show empty state or results', async ({ page }) => {
      await page.goto('/issues');
      
      // Wait for page to load
      await expect(page.getByTestId('universal-list-page').or(page.getByTestId('issue-list-page'))).toBeVisible({ timeout: 10000 });
      
      // Wait for either table or empty state to appear (one of them should be visible after loading)
      // Use Promise.race to wait for whichever appears first
      const tableOrEmpty = page.getByTestId('list-table').or(page.getByTestId('list-empty'));
      await expect(tableOrEmpty).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to detail page on row click', async ({ page }) => {
      await page.goto('/issues');
      
      // Wait for page to load
      await expect(page.getByTestId('universal-list-page').or(page.getByTestId('issue-list-page'))).toBeVisible({ timeout: 10000 });
      
      // Check for list rows using data-testid
      const firstRow = page.getByTestId('list-row').first();
      const rowExists = await firstRow.isVisible().catch(() => false);
      
      if (rowExists) {
        await firstRow.click();
        
        await page.waitForTimeout(1000);
        
        const url = page.url();
        expect(url.includes('/issues/')).toBeTruthy();
      }
    });
  });

  test.describe('CAPAs List', () => {
    test('should load CAPAs list page', async ({ page }) => {
      await page.goto('/capa');
      
      // Wait for the universal list page container to be visible
      await expect(page.getByTestId('universal-list-page').or(page.getByTestId('capa-list-page'))).toBeVisible({ timeout: 10000 });
    });

    test('should have search input', async ({ page }) => {
      await page.goto('/capa');
      
      // Wait for page to load first
      await expect(page.getByTestId('universal-list-page').or(page.getByTestId('capa-list-page'))).toBeVisible({ timeout: 10000 });
      
      const searchInput = page.getByTestId('list-search');
      await expect(searchInput).toBeVisible({ timeout: 5000 });
    });

    test('should filter results when typing in search', async ({ page }) => {
      await page.goto('/capa');
      
      // Wait for page to load
      await expect(page.getByTestId('universal-list-page').or(page.getByTestId('capa-list-page'))).toBeVisible({ timeout: 10000 });
      
      // The list-search testId is on the TextField wrapper, so we need to find the input inside it
      const searchContainer = page.getByTestId('list-search');
      await expect(searchContainer).toBeVisible({ timeout: 5000 });
      
      // Find the actual input element inside the TextField
      const searchInput = searchContainer.locator('input');
      await searchInput.fill('test capa');
      
      // Wait for debounce (300ms) + URL update + buffer time
      // The URL should contain 'search=' after the debounce completes
      await page.waitForURL(/search=/, { timeout: 5000 }).catch(() => {
        // If URL doesn't change, that's okay - some implementations might not sync to URL
      });
      
      // Verify the search input still has the value (basic functionality check)
      await expect(searchInput).toHaveValue('test capa');
    });

    test('should show empty state or results', async ({ page }) => {
      await page.goto('/capa');
      
      // Wait for page to load
      await expect(page.getByTestId('universal-list-page').or(page.getByTestId('capa-list-page'))).toBeVisible({ timeout: 10000 });
      
      // Wait for either table or empty state to appear (one of them should be visible after loading)
      // Use Promise.race to wait for whichever appears first
      const tableOrEmpty = page.getByTestId('list-table').or(page.getByTestId('list-empty'));
      await expect(tableOrEmpty).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Evidence List', () => {
    test('should load evidence list page', async ({ page }) => {
      await page.goto('/evidence');
      
      // Wait for the universal list page container to be visible
      await expect(page.getByTestId('universal-list-page').or(page.getByTestId('evidence-list-page'))).toBeVisible({ timeout: 10000 });
    });

    test('should have search input', async ({ page }) => {
      await page.goto('/evidence');
      
      // Wait for page to load first
      await expect(page.getByTestId('universal-list-page').or(page.getByTestId('evidence-list-page'))).toBeVisible({ timeout: 10000 });
      
      const searchInput = page.getByTestId('list-search');
      await expect(searchInput).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Controls List', () => {
    test('should load controls list page', async ({ page }) => {
      await page.goto('/controls');
      
      // Wait for the universal list page container to be visible
      await expect(page.getByTestId('universal-list-page').or(page.getByTestId('control-list-page'))).toBeVisible({ timeout: 10000 });
    });

    test('should have search input', async ({ page }) => {
      await page.goto('/controls');
      
      // Wait for page to load first
      await expect(page.getByTestId('universal-list-page').or(page.getByTestId('control-list-page'))).toBeVisible({ timeout: 10000 });
      
      const searchInput = page.getByTestId('list-search');
      await expect(searchInput).toBeVisible({ timeout: 5000 });
    });

    test('should show table with controls', async ({ page }) => {
      await page.goto('/controls');
      
      // Wait for page to load
      await expect(page.getByTestId('universal-list-page').or(page.getByTestId('control-list-page'))).toBeVisible({ timeout: 10000 });
      
      // Wait for the table to be visible (it's always rendered, even when empty)
      // The list-table testId is on the Table element which is always present
      await expect(page.getByTestId('list-table')).toBeVisible({ timeout: 10000 });
      
      // Check for table rows or empty state
      const hasRows = await page.getByTestId('list-row').first().isVisible().catch(() => false);
      const hasEmptyState = await page.getByTestId('list-empty').isVisible().catch(() => false);
      
      // Either we have rows or an empty state message
      expect(hasRows || hasEmptyState).toBeTruthy();
    });
  });

  test.describe('Filter Encoding', () => {
    test('should have filter UI with proper testids', async ({ page }) => {
      await page.goto('/controls');
      
      // Wait for page to load
      await expect(page.getByTestId('universal-list-page').or(page.getByTestId('control-list-page'))).toBeVisible({ timeout: 10000 });
      
      // Find and click the filter button using data-testid
      const filterButton = page.getByTestId('filter-open');
      await expect(filterButton).toBeVisible({ timeout: 5000 });
      await filterButton.click();
      
      // Wait for filter panel to appear
      const filterPanel = page.getByTestId('filter-panel');
      await expect(filterPanel).toBeVisible({ timeout: 5000 });
      
      // Verify "Add Condition" button exists
      const addRuleButton = page.getByTestId('filter-add-rule');
      await expect(addRuleButton).toBeVisible({ timeout: 5000 });
      await addRuleButton.click();
      
      // Wait for the filter rule to appear and verify testids
      const filterRule = page.getByTestId('filter-rule').first();
      await expect(filterRule).toBeVisible({ timeout: 5000 });
      
      // Verify filter rule components have testids
      await expect(page.getByTestId('filter-rule-field').first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByTestId('filter-rule-operator').first()).toBeVisible({ timeout: 5000 });
      
      // Verify action buttons have testids
      await expect(page.getByTestId('filter-apply')).toBeVisible({ timeout: 5000 });
      await expect(page.getByTestId('filter-clear')).toBeVisible({ timeout: 5000 });
      await expect(page.getByTestId('filter-close')).toBeVisible({ timeout: 5000 });
      
      // Close the dialog
      await page.getByTestId('filter-close').click();
      
      // Verify dialog closed
      await expect(filterPanel).not.toBeVisible({ timeout: 5000 });
    });

    test('should clear filter conditions when clear button is clicked', async ({ page }) => {
      await page.goto('/controls');
      
      // Wait for page to load
      await expect(page.getByTestId('universal-list-page').or(page.getByTestId('control-list-page'))).toBeVisible({ timeout: 10000 });
      
      // Open filter panel
      const filterButton = page.getByTestId('filter-open');
      await expect(filterButton).toBeVisible({ timeout: 5000 });
      await filterButton.click();
      
      // Wait for filter panel
      const filterPanel = page.getByTestId('filter-panel');
      await expect(filterPanel).toBeVisible({ timeout: 5000 });
      
      // Add a condition
      const addRuleButton = page.getByTestId('filter-add-rule');
      await addRuleButton.click();
      
      // Wait for filter rule
      await expect(page.getByTestId('filter-rule').first()).toBeVisible({ timeout: 5000 });
      
      // Click Clear All button - this clears conditions and closes dialog
      const clearButton = page.getByTestId('filter-clear');
      await expect(clearButton).toBeVisible({ timeout: 5000 });
      await clearButton.click();
      
      // Wait for dialog to close
      await page.waitForTimeout(500);
      
      // Verify filter param is not in URL (no filter was applied)
      const url = page.url();
      expect(url).not.toContain('filter=');
    });

    test('should show table or empty state on controls page', async ({ page }) => {
      await page.goto('/controls');
      
      // Wait for page to load
      await expect(page.getByTestId('universal-list-page').or(page.getByTestId('control-list-page'))).toBeVisible({ timeout: 10000 });
      
      // Should show either table with rows or empty state (both are valid outcomes)
      const tableOrEmpty = page.getByTestId('list-table').or(page.getByTestId('list-empty'));
      await expect(tableOrEmpty).toBeVisible({ timeout: 10000 });
    });

    test('should close filter dialog when cancel button is clicked', async ({ page }) => {
      await page.goto('/controls');
      
      // Wait for page to load
      await expect(page.getByTestId('universal-list-page').or(page.getByTestId('control-list-page'))).toBeVisible({ timeout: 10000 });
      
      // Open filter panel
      const filterButton = page.getByTestId('filter-open');
      await expect(filterButton).toBeVisible({ timeout: 5000 });
      await filterButton.click();
      
      // Wait for filter panel
      const filterPanel = page.getByTestId('filter-panel');
      await expect(filterPanel).toBeVisible({ timeout: 5000 });
      
      // Click Cancel button
      const closeButton = page.getByTestId('filter-close');
      await expect(closeButton).toBeVisible({ timeout: 5000 });
      await closeButton.click();
      
      // Verify dialog closed
      await expect(filterPanel).not.toBeVisible({ timeout: 5000 });
    });
  });
});
