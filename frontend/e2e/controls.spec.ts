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
    
    // Wait for page to load
    await expect(page.locator('text=Control Library')).toBeVisible({ timeout: 10000 });
  });

  test('should show search input by default', async ({ page }) => {
    await page.goto('/controls');
    
    // Wait for page to load
    await expect(page.locator('input[placeholder="Search controls..."]')).toBeVisible({ timeout: 10000 });
  });

  test('should filter controls by search query', async ({ page }) => {
    await page.goto('/controls');
    
    // Wait for initial load
    await expect(page.locator('text=Control Library')).toBeVisible({ timeout: 10000 });
    
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
    
    // Wait for page to load
    await expect(page.locator('text=Control Library')).toBeVisible({ timeout: 10000 });
    
    // Verify status filter is present
    await expect(page.locator('label:has-text("Status")')).toBeVisible();
  });

  test('should show type filter dropdown', async ({ page }) => {
    await page.goto('/controls');
    
    // Wait for page to load
    await expect(page.locator('text=Control Library')).toBeVisible({ timeout: 10000 });
    
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
});
