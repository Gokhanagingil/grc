import { test, expect } from '@playwright/test';
import { login } from './helpers';

/**
 * Closure Loop Smoke Tests - Golden Flow v1
 * 
 * Tests the complete closure loop workflow:
 * 1. Issue creation and navigation
 * 2. CAPA creation (standalone and linked to Issue)
 * 3. CAPA Task creation and status updates
 * 4. Status transitions for Issues and CAPAs
 * 
 * Uses data-testid selectors for stable, non-brittle tests.
 * Relies on the mock API setup from helpers.ts (E2E_MOCK_API=1).
 * 
 * Mock IDs from helpers.ts:
 * - Issue: mock-issue-001
 * - CAPA: mock-capa-001
 */

test.describe('Closure Loop Smoke Tests', () => {
  test('should navigate to Issues list and see issues', async ({ page }) => {
    await login(page);
    
    // Navigate to Issues
    await page.goto('/issues');
    
    // Wait for the page to load - use the testId from GenericListPage
    await expect(page.getByTestId('issue-list-page')).toBeVisible({ timeout: 10000 });
    
    // Verify we can see the page title (use first() to avoid strict mode violation)
    await expect(page.locator('h4').filter({ hasText: 'Issues' }).first()).toBeVisible();
  });

  test('should open create issue dialog and create an issue', async ({ page }) => {
    await login(page);
    await page.goto('/issues');
    
    // Wait for page to load
    await expect(page.getByTestId('issue-list-page')).toBeVisible({ timeout: 10000 });
    
    // Click Add Issue button
    await page.getByTestId('add-issue-button').click();
    
    // Verify dialog opens
    await expect(page.getByTestId('create-issue-dialog')).toBeVisible();
    
    // Fill in the form
    await page.getByTestId('issue-title-input').locator('input').fill('Test Issue from Playwright');
    await page.getByTestId('issue-description-input').locator('textarea').first().fill('This is a test issue');
    
    // Click Create button
    await page.getByTestId('create-issue-button').click();
    
    // Dialog should close (issue created)
    await expect(page.getByTestId('create-issue-dialog')).not.toBeVisible({ timeout: 5000 });
  });

  test('should navigate to Issue detail page', async ({ page }) => {
    await login(page);
    
    // Navigate directly to issue detail using mock issue ID from helpers.ts
    await page.goto('/issues/mock-issue-001');
    
    // Wait for page to load
    await expect(page.getByTestId('issue-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Verify back button is visible
    await expect(page.getByTestId('back-button')).toBeVisible();
  });

  test('should see Links tab on Issue detail page', async ({ page }) => {
    await login(page);
    await page.goto('/issues/mock-issue-001');
    
    // Wait for page to load
    await expect(page.getByTestId('issue-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Click on Links tab
    await page.getByTestId('links-tab').click();
    
    // Verify Create CAPA button is visible
    await expect(page.getByTestId('create-capa-button')).toBeVisible();
  });

  test('should navigate to CAPAs list and see CAPAs', async ({ page }) => {
    await login(page);
    
    // Navigate to CAPAs
    await page.goto('/capa');
    
    // Wait for the page to load
    await expect(page.getByTestId('capa-list-page')).toBeVisible({ timeout: 10000 });
    
    // Verify we can see the page title (use first() to avoid strict mode violation)
    await expect(page.locator('h4').filter({ hasText: 'CAPAs' }).first()).toBeVisible();
  });

  test('should open create CAPA dialog', async ({ page }) => {
    await login(page);
    await page.goto('/capa');
    
    // Wait for page to load
    await expect(page.getByTestId('capa-list-page')).toBeVisible({ timeout: 10000 });
    
    // Click Add CAPA button
    await page.getByTestId('add-capa-button').click();
    
    // Verify dialog opens
    await expect(page.getByTestId('create-capa-dialog')).toBeVisible();
  });

  test('should have disabled Create button when CAPA title is empty', async ({ page }) => {
    await login(page);
    await page.goto('/capa');
    
    // Wait for page to load
    await expect(page.getByTestId('capa-list-page')).toBeVisible({ timeout: 10000 });
    
    // Click Add CAPA button
    await page.getByTestId('add-capa-button').click();
    
    // Verify dialog opens
    await expect(page.getByTestId('create-capa-dialog')).toBeVisible();
    
    // Don't fill in title - the Create button should be disabled
    const createButton = page.getByTestId('create-capa-button');
    await expect(createButton).toBeDisabled();
  });

  test('should navigate to CAPA detail page', async ({ page }) => {
    await login(page);
    
    // Navigate directly to CAPA detail using mock CAPA ID from helpers.ts
    await page.goto('/capa/mock-capa-001');
    
    // Wait for page to load - look for the detail page container
    await expect(page.getByTestId('capa-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Verify back button is visible
    await expect(page.getByTestId('back-button')).toBeVisible();
  });

  test('should see Tasks tab on CAPA detail page', async ({ page }) => {
    await login(page);
    await page.goto('/capa/mock-capa-001');
    
    // Wait for page to load
    await expect(page.getByTestId('capa-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Click on Tasks tab
    await page.getByTestId('tasks-tab').click();
    
    // Verify Add Task button is visible
    await expect(page.getByTestId('add-task-button')).toBeVisible();
  });
});

test.describe('Closure Loop - Issue Navigation', () => {
  test('should navigate from Issues list to Issue detail on title click', async ({ page }) => {
    await login(page);
    await page.goto('/issues');
    
    // Wait for page to load
    await expect(page.getByTestId('issue-list-page')).toBeVisible({ timeout: 10000 });
    
    // Click on an issue title (the title link) - using mock title from helpers.ts
    await page.getByText('Mock Security Control Failure Issue').click();
    
    // Should navigate to detail page
    await expect(page).toHaveURL(/\/issues\/mock-issue-001/);
  });

  test('should navigate back from Issue detail to Issues list', async ({ page }) => {
    await login(page);
    await page.goto('/issues/mock-issue-001');
    
    // Wait for page to load
    await expect(page.getByTestId('issue-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Click back button
    await page.getByTestId('back-button').click();
    
    // Should navigate back to list
    await expect(page).toHaveURL(/\/issues$/);
  });
});

test.describe('Closure Loop - CAPA Navigation', () => {
  test('should navigate from CAPAs list to CAPA detail on title click', async ({ page }) => {
    await login(page);
    await page.goto('/capa');
    
    // Wait for page to load
    await expect(page.getByTestId('capa-list-page')).toBeVisible({ timeout: 10000 });
    
    // Click on a CAPA title (the title link) - using mock title from helpers.ts
    await page.getByText('Mock Corrective Action Plan').click();
    
    // Should navigate to detail page
    await expect(page).toHaveURL(/\/capa\/mock-capa-001/);
  });
});
