/**
 * RC1 Smoke Test: Login + Risks Page
 * 
 * This test validates the Risks list page functionality and risk creation flow.
 * It's designed to run against the staging environment (http://46.224.99.150) or locally.
 * 
 * Environment Variables:
 *   E2E_BASE_URL - Base URL for tests (default: http://localhost:3000)
 *   E2E_MOCK_API - Set to '1' to use mock API responses
 *   E2E_EMAIL - Admin email (default: admin@grc-platform.local)
 *   E2E_PASSWORD - Admin password (default: TestPassword123!)
 */

import { test, expect } from '@playwright/test';
import { login, expectListLoaded, setupMockApi } from '../helpers';

test.describe('RC1 Smoke: Login + Risks', () => {
  test.beforeEach(async ({ page }) => {
    // Setup mock API if enabled
    await setupMockApi(page);
  });

  test('should login successfully and load Risks list page', async ({ page }) => {
    // Step 1: Login
    await login(page);
    
    // Verify we're on the dashboard after login
    await expect(page).toHaveURL(/\/(dashboard|admin)/);
    
    // Step 2: Navigate to Risks page
    // Click on GRC Library section in sidebar
    const grcLibrarySection = page.locator('text=GRC Library').first();
    if (await grcLibrarySection.isVisible()) {
      await grcLibrarySection.click();
    }
    
    // Click on Risks menu item
    const risksMenuItem = page.locator('[data-testid="nav-item-risks"]').or(
      page.locator('a[href*="/risks"]').first()
    ).or(
      page.locator('text=Risks').first()
    );
    
    // Wait for risks menu item to be visible and click
    await expect(risksMenuItem.first()).toBeVisible({ timeout: 10000 });
    await risksMenuItem.first().click();
    
    // Step 3: Verify Risks list page loaded
    // Wait for URL to change to risks page
    await page.waitForURL(/\/risks/, { timeout: 15000 });
    
    // Verify page title or header
    const pageHeader = page.locator('h1, h2, [data-testid="page-title"]').filter({ hasText: /risk/i });
    await expect(pageHeader.first()).toBeVisible({ timeout: 10000 });
    
    // Step 4: Verify list loaded (either table with data or empty state)
    const listState = await expectListLoaded(page, 20000);
    
    // Log the result for debugging
    console.log(`Risks list loaded with state: ${listState}`);
    
    // Step 5: Verify search input is present (list standardization check)
    const searchInput = page.locator('[data-testid="search-input"]').or(
      page.locator('input[placeholder*="Search"]').or(
        page.locator('input[type="search"]')
      )
    );
    
    // Search input should be visible (part of list standardization)
    await expect(searchInput.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display Risks list with proper LIST-CONTRACT format', async ({ page }) => {
    // This test verifies the API response format matches LIST-CONTRACT
    await login(page);
    
    // Navigate to Risks
    await page.goto('/risks');
    
    // Wait for the risks API call
    const risksResponse = await page.waitForResponse(
      (response) => response.url().includes('/grc/risks') && response.request().method() === 'GET',
      { timeout: 15000 }
    );
    
    // Verify response status
    expect(risksResponse.status()).toBe(200);
    
    // Verify LIST-CONTRACT format in response
    const responseBody = await risksResponse.json();
    
    // Check for LIST-CONTRACT shape (either direct or wrapped in data envelope)
    const data = responseBody.data || responseBody;
    
    // LIST-CONTRACT requires: items, total, page, pageSize, totalPages
    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('page');
    expect(data).toHaveProperty('pageSize');
    expect(data).toHaveProperty('totalPages');
    
    // Verify items is an array
    expect(Array.isArray(data.items)).toBe(true);
    
    // Verify pagination values are numbers
    expect(typeof data.total).toBe('number');
    expect(typeof data.page).toBe('number');
    expect(typeof data.pageSize).toBe('number');
    expect(typeof data.totalPages).toBe('number');
  });

  test('should have New Risk button visible on Risks page', async ({ page }) => {
    await login(page);
    
    // Navigate to Risks
    await page.goto('/risks');
    
    // Wait for list to load
    await expectListLoaded(page, 20000);
    
    // Find "New Risk" or "Add Risk" button
    const newRiskButton = page.locator('[data-testid="new-risk-button"]').or(
      page.locator('button').filter({ hasText: /new risk|add risk|create risk/i })
    );
    
    // Verify the button is visible
    await expect(newRiskButton.first()).toBeVisible({ timeout: 5000 });
  });

  test('should handle search functionality on Risks page', async ({ page }) => {
    await login(page);
    
    // Navigate to Risks
    await page.goto('/risks');
    
    // Wait for initial list load
    await expectListLoaded(page, 20000);
    
    // Find search input
    const searchInput = page.locator('[data-testid="search-input"]').or(
      page.locator('input[placeholder*="Search"]').or(
        page.locator('input[type="search"]')
      )
    );
    
    await expect(searchInput.first()).toBeVisible({ timeout: 5000 });
    
    // Type a search query
    await searchInput.first().fill('data breach');
    
    // Wait for debounced search to trigger API call
    await page.waitForTimeout(500);
    
    // Verify URL contains search parameter (no double-encoding)
    const url = page.url();
    
    // Check that search param is properly encoded (single encode, not double)
    // A properly encoded URL should have search=data%20breach (space encoded once)
    // NOT search=data%2520breach (double encoded)
    expect(url).not.toContain('%25'); // %25 is the encoding of %, indicating double-encoding
    
    // Verify list reloaded after search
    await expectListLoaded(page, 10000);
  });

  test('should display filter options on Risks page', async ({ page }) => {
    await login(page);
    
    // Navigate to Risks
    await page.goto('/risks');
    
    // Wait for list to load
    await expectListLoaded(page, 20000);
    
    // Look for filter-related UI elements
    // This could be a filter button, filter chips, or advanced filter builder
    const filterElements = page.locator('[data-testid="filter-button"]').or(
      page.locator('[data-testid="advanced-filter"]').or(
        page.locator('button').filter({ hasText: /filter/i })
      )
    );
    
    // At least one filter element should be present
    const filterCount = await filterElements.count();
    
    // Log filter availability for debugging
    console.log(`Found ${filterCount} filter elements on Risks page`);
    
    // Verify at least basic filtering capability exists
    // (either filter button or filter chips or status dropdown)
    const statusFilter = page.locator('[data-testid="status-filter"]').or(
      page.locator('select').filter({ hasText: /status/i }).or(
        page.locator('[role="combobox"]').filter({ hasText: /status/i })
      )
    );
    
    const hasFilters = filterCount > 0 || await statusFilter.count() > 0;
    expect(hasFilters).toBe(true);
  });
});
