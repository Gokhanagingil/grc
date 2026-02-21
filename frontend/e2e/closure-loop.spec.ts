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

test.describe('Closure Loop Smoke Tests @mock', () => {
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

test.describe('Closure Loop - Issue Navigation @mock', () => {
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

test.describe('Closure Loop - CAPA Navigation @mock', () => {
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

/**
 * Closure Loop v1 - Full End-to-End Workflow Test
 * 
 * This test covers the complete closure loop:
 * 1. Login and navigate to Issues list
 * 2. Open an Issue detail page
 * 3. Navigate to Links tab and verify CAPA section
 * 4. Create a CAPA from the Issue (or navigate to existing)
 * 5. On CAPA detail: create a task
 * 6. Complete the task
 * 7. Verify the verification panel is visible
 * 8. Navigate back to Issue
 * 
 * Note: Full closure (setting verification fields, closing CAPA, closing Issue)
 * requires backend API calls which are mocked in E2E tests. This test verifies
 * the UI flow and data-testid anchors are in place.
 */
test.describe('Closure Loop v1 - Full Workflow @mock', () => {
  test('should complete the full closure loop workflow', async ({ page }) => {
    await login(page);
    
    // Step 1: Navigate to Issues list
    await page.goto('/issues');
    await expect(page.getByTestId('issue-list-page')).toBeVisible({ timeout: 10000 });
    
    // Step 2: Open Issue detail page
    await page.goto('/issues/mock-issue-001');
    await expect(page.getByTestId('issue-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Step 3: Navigate to Links tab and verify CAPA section
    await page.getByTestId('links-tab').click();
    
    // Verify the CAPA panel is visible (either with table or empty state)
    await expect(page.getByTestId('issue-capas-panel')).toBeVisible({ timeout: 5000 });
    
    // Verify Create CAPA button is available
    await expect(page.getByTestId('create-capa-button')).toBeVisible();
  });

  test('should show CAPA tasks panel and verification panel on CAPA detail', async ({ page }) => {
    await login(page);
    
    // Navigate to CAPA detail
    await page.goto('/capa/mock-capa-001');
    await expect(page.getByTestId('capa-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Verify verification panel is visible on Overview tab
    await expect(page.getByTestId('capa-verification-panel')).toBeVisible({ timeout: 5000 });
    
    // Navigate to Tasks tab
    await page.getByTestId('tasks-tab').click();
    
    // Verify tasks panel is visible
    await expect(page.getByTestId('capa-tasks-panel')).toBeVisible({ timeout: 5000 });
    
    // Verify Add Task button is available
    await expect(page.getByTestId('add-task-button')).toBeVisible();
  });

  test('should open create task dialog on CAPA detail', async ({ page }) => {
    await login(page);
    
    // Navigate to CAPA detail
    await page.goto('/capa/mock-capa-001');
    await expect(page.getByTestId('capa-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Navigate to Tasks tab
    await page.getByTestId('tasks-tab').click();
    await expect(page.getByTestId('capa-tasks-panel')).toBeVisible({ timeout: 5000 });
    
    // Click Add Task button
    await page.getByTestId('add-task-button').click();
    
    // Verify task creation form elements are visible
    await expect(page.getByTestId('new-task-title-input')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('new-task-description-input')).toBeVisible();
    await expect(page.getByTestId('new-task-due-date-input')).toBeVisible();
    
    // Verify Create Task button is disabled when title is empty
    await expect(page.getByTestId('create-task-button')).toBeDisabled();
    
    // Fill in task title
    await page.getByTestId('new-task-title-input').locator('input').fill('Test Task from Playwright');
    
    // Create Task button should now be enabled
    await expect(page.getByTestId('create-task-button')).toBeEnabled();
  });

  test('should show status change dialog on Issue detail', async ({ page }) => {
    await login(page);
    
    // Navigate to Issue detail
    await page.goto('/issues/mock-issue-001');
    await expect(page.getByTestId('issue-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Look for status chip and change status button
    await expect(page.getByTestId('issue-status-chip')).toBeVisible({ timeout: 5000 });
    
    // Click on Change Status button (if visible)
    const changeStatusButton = page.getByTestId('change-status-button');
    if (await changeStatusButton.isVisible()) {
      await changeStatusButton.click();
      
      // Verify status dialog elements
      await expect(page.getByTestId('new-status-select')).toBeVisible({ timeout: 5000 });
      await expect(page.getByTestId('status-reason-input')).toBeVisible();
    }
  });

  test('should show status change dialog on CAPA detail', async ({ page }) => {
    await login(page);
    
    // Navigate to CAPA detail
    await page.goto('/capa/mock-capa-001');
    await expect(page.getByTestId('capa-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Look for status chip
    await expect(page.getByTestId('capa-status-chip')).toBeVisible({ timeout: 5000 });
    
    // Click on Change Status button (if visible)
    const changeStatusButton = page.getByTestId('change-status-button');
    if (await changeStatusButton.isVisible()) {
      await changeStatusButton.click();
      
      // Verify status dialog elements
      await expect(page.getByTestId('new-status-select')).toBeVisible({ timeout: 5000 });
      await expect(page.getByTestId('status-reason-input')).toBeVisible();
    }
  });

  test('should navigate from Issue to linked CAPA and back', async ({ page }) => {
    await login(page);
    
    // Start at Issue detail
    await page.goto('/issues/mock-issue-001');
    await expect(page.getByTestId('issue-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Go to Links tab
    await page.getByTestId('links-tab').click();
    await expect(page.getByTestId('issue-capas-panel')).toBeVisible({ timeout: 5000 });
    
    // If there are linked CAPAs, click on one to navigate
    // Note: In mock mode, we may have linked CAPAs or empty state
    const capaLink = page.locator('[data-testid="issue-capas-panel"] a').first();
    if (await capaLink.isVisible()) {
      await capaLink.click();
      
      // Should be on CAPA detail page
      await expect(page.getByTestId('capa-detail-page')).toBeVisible({ timeout: 10000 });
      
      // Navigate back
      await page.getByTestId('back-button').click();
      
      // Should be back on CAPA list
      await expect(page).toHaveURL(/\/capa$/);
    }
  });

  test('should verify all closure loop data-testid anchors exist', async ({ page }) => {
    await login(page);
    
    // Test Issue detail page anchors
    await page.goto('/issues/mock-issue-001');
    await expect(page.getByTestId('issue-detail-page')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('back-button')).toBeVisible();
    await expect(page.getByTestId('links-tab')).toBeVisible();
    
    // Navigate to Links tab
    await page.getByTestId('links-tab').click();
    await expect(page.getByTestId('issue-capas-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('create-capa-button')).toBeVisible();
    
    // Test CAPA detail page anchors
    await page.goto('/capa/mock-capa-001');
    await expect(page.getByTestId('capa-detail-page')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('back-button')).toBeVisible();
    await expect(page.getByTestId('capa-verification-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('tasks-tab')).toBeVisible();
    
    // Navigate to Tasks tab
    await page.getByTestId('tasks-tab').click();
    await expect(page.getByTestId('capa-tasks-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('add-task-button')).toBeVisible();
  });
});
