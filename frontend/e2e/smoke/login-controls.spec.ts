/**
 * RC1 Smoke Test: Login + Controls List
 * 
 * This test validates the core authentication flow and Controls list page functionality.
 * It's designed to run against the staging environment (http://46.224.99.150) or locally
 * with a real backend. These tests are SKIPPED when E2E_MOCK_API=1 because they require
 * real API responses and specific UI elements that may not be present in mock mode.
 * 
 * Environment Variables:
 *   E2E_BASE_URL - Base URL for tests (default: http://localhost:3000)
 *   E2E_MOCK_API - Set to '1' to skip these tests (they require real backend)
 *   E2E_EMAIL - Admin email (default: admin@grc-platform.local)
 *   E2E_PASSWORD - Admin password (default: TestPassword123!)
 * 
 * To run against staging:
 *   E2E_BASE_URL=http://46.224.99.150 npx playwright test e2e/smoke/
 */

import { test, expect } from '@playwright/test';
import { login, expectListLoaded, setupMockApi, TEST_CREDENTIALS } from '../helpers';

// Skip all smoke tests when running in mock API mode
// These tests are designed for staging/real backend verification
const isMockMode = process.env.E2E_MOCK_API === '1';

test.describe('RC1 Smoke: Login + Controls @mock', () => {
  // Skip entire suite in mock mode
  test.skip(isMockMode, 'Smoke tests require real backend - skipping in mock API mode');

  test.beforeEach(async ({ page }) => {
    // Setup mock API if enabled (no-op when not in mock mode)
    await setupMockApi(page);
  });

  test('should login successfully and load Controls list page', async ({ page }) => {
    // Step 1: Login
    await login(page);
    
    // Verify we're on the dashboard after login
    await expect(page).toHaveURL(/\/(dashboard|admin)/);
    
    // Step 2: Navigate to Controls page
    // Click on GRC Library section in sidebar
    const grcLibrarySection = page.locator('text=GRC Library').first();
    if (await grcLibrarySection.isVisible()) {
      await grcLibrarySection.click();
    }
    
    // Click on Controls menu item
    const controlsMenuItem = page.locator('[data-testid="nav-item-controls"]').or(
      page.locator('a[href*="/controls"]').first()
    ).or(
      page.locator('text=Controls').first()
    );
    
    // Wait for controls menu item to be visible and click
    await expect(controlsMenuItem.first()).toBeVisible({ timeout: 10000 });
    await controlsMenuItem.first().click();
    
    // Step 3: Verify Controls list page loaded
    // Wait for URL to change to controls page
    await page.waitForURL(/\/controls/, { timeout: 15000 });
    
    // Verify page title or header
    const pageHeader = page.locator('h1, h2, [data-testid="page-title"]').filter({ hasText: /controls/i });
    await expect(pageHeader.first()).toBeVisible({ timeout: 10000 });
    
    // Step 4: Verify list loaded (either table with data or empty state)
    const listState = await expectListLoaded(page, 20000);
    
    // Log the result for debugging
    console.log(`Controls list loaded with state: ${listState}`);
    
    // Step 5: Verify search input is present (list standardization check)
    const searchInput = page.locator('[data-testid="search-input"]').or(
      page.locator('input[placeholder*="Search"]').or(
        page.locator('input[type="search"]')
      )
    );
    
    // Search input should be visible (part of list standardization)
    await expect(searchInput.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display Controls list with proper LIST-CONTRACT format', async ({ page }) => {
    // This test verifies the API response format matches LIST-CONTRACT
    await login(page);
    
    // Navigate to Controls
    await page.goto('/controls');
    
    // Wait for the controls API call
    const controlsResponse = await page.waitForResponse(
      (response) => response.url().includes('/grc/controls') && response.request().method() === 'GET',
      { timeout: 15000 }
    );
    
    // Verify response status
    expect(controlsResponse.status()).toBe(200);
    
    // Verify LIST-CONTRACT format in response
    const responseBody = await controlsResponse.json();
    
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

  test('should handle search functionality on Controls page', async ({ page }) => {
    await login(page);
    
    // Navigate to Controls
    await page.goto('/controls');
    
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
    await searchInput.first().fill('access');
    
    // Wait for debounced search to trigger API call
    await page.waitForTimeout(500);
    
    // Verify URL contains search parameter (no double-encoding)
    const url = page.url();
    
    // Check that search param is properly encoded (single encode, not double)
    // A properly encoded URL should have search=access or q=access
    // NOT search=access%2520 (double encoded)
    expect(url).not.toContain('%25'); // %25 is the encoding of %, indicating double-encoding
    
    // Verify list reloaded after search
    await expectListLoaded(page, 10000);
  });
});
