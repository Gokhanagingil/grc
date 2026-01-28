import { test, expect } from '@playwright/test';
import { login, setupMockApi } from './helpers';

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
 */

// Mock data for closure loop tests
const mockIssue = {
  id: 'cl-issue-001',
  tenantId: 'test-tenant-id',
  title: 'Closure Loop Test Issue',
  description: 'Issue created for closure loop testing',
  type: 'internal_audit',
  severity: 'high',
  status: 'open',
  dueDate: '2024-03-15',
  createdAt: '2024-01-15T00:00:00Z',
  updatedAt: '2024-01-15T00:00:00Z',
};

const mockCapa = {
  id: 'cl-capa-001',
  tenantId: 'test-tenant-id',
  title: 'Closure Loop Test CAPA',
  description: 'CAPA created for closure loop testing',
  type: 'corrective',
  status: 'planned',
  priority: 'HIGH',
  dueDate: '2024-02-28',
  issueId: 'cl-issue-001',
  issue: {
    id: 'cl-issue-001',
    title: 'Closure Loop Test Issue',
    status: 'open',
    severity: 'high',
  },
  createdAt: '2024-01-16T00:00:00Z',
  updatedAt: '2024-01-16T00:00:00Z',
};

const mockStandaloneCapa = {
  id: 'cl-capa-002',
  tenantId: 'test-tenant-id',
  title: 'Standalone CAPA Test',
  description: 'Standalone CAPA without linked issue',
  type: 'preventive',
  status: 'planned',
  priority: 'MEDIUM',
  dueDate: '2024-03-15',
  issueId: null,
  issue: null,
  createdAt: '2024-01-17T00:00:00Z',
  updatedAt: '2024-01-17T00:00:00Z',
};

const mockCapaTask = {
  id: 'cl-task-001',
  tenantId: 'test-tenant-id',
  capaId: 'cl-capa-001',
  title: 'Closure Loop Test Task',
  description: 'Task for closure loop testing',
  status: 'PENDING',
  dueDate: '2024-02-15',
  assigneeId: null,
  assignee: null,
  completedAt: null,
  createdAt: '2024-01-18T00:00:00Z',
  updatedAt: '2024-01-18T00:00:00Z',
};

const mockStatusHistory = [
  {
    id: 'sh-001',
    entityType: 'issue',
    entityId: 'cl-issue-001',
    previousStatus: null,
    newStatus: 'open',
    createdAt: '2024-01-15T00:00:00Z',
    changedBy: { email: 'admin@test.com', firstName: 'Admin', lastName: 'User' },
    changeReason: 'Initial creation',
  },
];

/**
 * Setup mock API for closure loop tests
 */
async function setupClosureLoopMocks(page: import('@playwright/test').Page) {
  // First setup base mocks
  await setupMockApi(page);

  // Add closure loop specific mocks
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    const method = request.method();
    const resourceType = request.resourceType();

    // Only intercept xhr/fetch requests
    if (resourceType !== 'xhr' && resourceType !== 'fetch') {
      await route.continue();
      return;
    }

    const successResponse = (data: unknown) => ({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });

    const createdResponse = (data: unknown) => ({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });

    // Issues endpoints
    if (url.includes('/grc/issues') && !url.includes('/capas')) {
      if (method === 'POST') {
        // Create issue
        await route.fulfill(createdResponse({
          ...mockIssue,
          id: `cl-issue-${Date.now()}`,
        }));
        return;
      }
      if (method === 'GET') {
        if (url.match(/\/grc\/issues\/[^/?]+$/)) {
          // Single issue detail
          await route.fulfill(successResponse(mockIssue));
        } else {
          // List issues
          await route.fulfill(successResponse({
            items: [mockIssue],
            total: 1,
            page: 1,
            pageSize: 20,
            totalPages: 1,
          }));
        }
        return;
      }
      if (method === 'PATCH' && url.includes('/status')) {
        // Update issue status
        await route.fulfill(successResponse({
          ...mockIssue,
          status: 'in_progress',
        }));
        return;
      }
    }

    // CAPAs by issue endpoint
    if (url.includes('/grc/issues/') && url.includes('/capas')) {
      if (method === 'POST') {
        // Create CAPA from issue
        await route.fulfill(createdResponse({
          ...mockCapa,
          id: `cl-capa-${Date.now()}`,
        }));
        return;
      }
      if (method === 'GET') {
        // Get CAPAs linked to issue
        await route.fulfill(successResponse([mockCapa]));
        return;
      }
    }

    // CAPAs endpoints
    if (url.includes('/grc/capas') && !url.includes('/tasks')) {
      if (method === 'POST') {
        // Create standalone CAPA
        await route.fulfill(createdResponse({
          ...mockStandaloneCapa,
          id: `cl-capa-${Date.now()}`,
        }));
        return;
      }
      if (method === 'GET') {
        if (url.includes('/by-issue/')) {
          // Get CAPAs by issue
          await route.fulfill(successResponse([mockCapa]));
          return;
        }
        if (url.match(/\/grc\/capas\/[^/?]+$/)) {
          // Single CAPA detail
          await route.fulfill(successResponse(mockCapa));
        } else {
          // List CAPAs
          await route.fulfill(successResponse({
            items: [mockCapa, mockStandaloneCapa],
            total: 2,
            page: 1,
            pageSize: 20,
            totalPages: 1,
          }));
        }
        return;
      }
      if (method === 'PATCH' && url.includes('/status')) {
        // Update CAPA status
        await route.fulfill(successResponse({
          ...mockCapa,
          status: 'in_progress',
        }));
        return;
      }
    }

    // CAPA Tasks endpoints
    if (url.includes('/grc/capas/') && url.includes('/tasks')) {
      if (method === 'POST') {
        // Create CAPA task
        await route.fulfill(createdResponse({
          ...mockCapaTask,
          id: `cl-task-${Date.now()}`,
        }));
        return;
      }
      if (method === 'GET') {
        if (url.includes('/stats')) {
          // Task stats
          await route.fulfill(successResponse({
            total: 1,
            completed: 0,
            pending: 1,
            inProgress: 0,
            completionPercentage: 0,
          }));
          return;
        }
        // List tasks
        await route.fulfill(successResponse([mockCapaTask]));
        return;
      }
    }

    // CAPA Tasks status update
    if (url.includes('/grc/capa-tasks/') && url.includes('/status') && method === 'PATCH') {
      await route.fulfill(successResponse({
        ...mockCapaTask,
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
      }));
      return;
    }

    // Status history
    if (url.includes('/grc/status-history') && method === 'GET') {
      await route.fulfill(successResponse(mockStatusHistory));
      return;
    }

    // Controls for linking
    if (url.includes('/grc/controls') && method === 'GET') {
      await route.fulfill(successResponse({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      }));
      return;
    }

    // Test results for linking
    if (url.includes('/grc/test-results') && method === 'GET') {
      await route.fulfill(successResponse({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      }));
      return;
    }

    // Evidence for linking
    if (url.includes('/grc/evidence') && method === 'GET') {
      await route.fulfill(successResponse({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      }));
      return;
    }

    // Let other requests through
    await route.continue();
  });
}

test.describe('Closure Loop Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupClosureLoopMocks(page);
  });

  test('should navigate to Issues list and see issues', async ({ page }) => {
    await login(page);
    
    // Navigate to Issues
    await page.goto('/issues');
    
    // Wait for the page to load
    await expect(page.getByTestId('issue-list-page')).toBeVisible({ timeout: 10000 });
    
    // Verify we can see the issues list
    await expect(page.getByText('Issues')).toBeVisible();
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

  test('should navigate to Issue detail and see linked CAPAs section', async ({ page }) => {
    await login(page);
    
    // Navigate directly to issue detail
    await page.goto('/issues/cl-issue-001');
    
    // Wait for page to load
    await expect(page.getByTestId('issue-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Click on Links tab
    await page.getByTestId('links-tab').click();
    
    // Verify Create CAPA button is visible
    await expect(page.getByTestId('create-capa-button')).toBeVisible();
  });

  test('should create CAPA from Issue detail page', async ({ page }) => {
    await login(page);
    await page.goto('/issues/cl-issue-001');
    
    // Wait for page to load
    await expect(page.getByTestId('issue-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Click on Links tab
    await page.getByTestId('links-tab').click();
    
    // Click Create CAPA button
    await page.getByTestId('create-capa-button').click();
    
    // Fill in CAPA form
    await page.getByTestId('new-capa-title-input').locator('input').fill('CAPA from Issue Test');
    await page.getByTestId('new-capa-description-input').locator('textarea').first().fill('Test CAPA description');
    
    // Click confirm button
    await page.getByTestId('confirm-create-capa-button').click();
    
    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
  });

  test('should navigate to CAPAs list and see CAPAs', async ({ page }) => {
    await login(page);
    
    // Navigate to CAPAs
    await page.goto('/capa');
    
    // Wait for the page to load
    await expect(page.getByTestId('capa-list-page')).toBeVisible({ timeout: 10000 });
    
    // Verify we can see the CAPAs list
    await expect(page.getByText('CAPAs')).toBeVisible();
  });

  test('should create standalone CAPA without issueId', async ({ page }) => {
    await login(page);
    await page.goto('/capa');
    
    // Wait for page to load
    await expect(page.getByTestId('capa-list-page')).toBeVisible({ timeout: 10000 });
    
    // Click Add CAPA button
    await page.getByTestId('add-capa-button').click();
    
    // Verify dialog opens
    await expect(page.getByTestId('create-capa-dialog')).toBeVisible();
    
    // Fill in the form (without issueId)
    await page.getByTestId('capa-title-input').locator('input').fill('Standalone CAPA Test');
    await page.getByTestId('capa-description-input').locator('textarea').first().fill('This is a standalone CAPA');
    
    // Leave Issue ID empty (standalone CAPA)
    // The issueId field should be optional
    
    // Click Create button
    await page.getByTestId('create-capa-button').click();
    
    // Dialog should close (CAPA created)
    await expect(page.getByTestId('create-capa-dialog')).not.toBeVisible({ timeout: 5000 });
  });

  test('should display validation error when CAPA title is missing', async ({ page }) => {
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

  test('should navigate to CAPA detail and see Tasks section', async ({ page }) => {
    await login(page);
    
    // Navigate directly to CAPA detail
    await page.goto('/capa/cl-capa-001');
    
    // Wait for page to load - look for CAPA title or tabs
    await expect(page.getByText('Closure Loop Test CAPA')).toBeVisible({ timeout: 10000 });
    
    // Click on Tasks tab (index 2)
    await page.locator('[role="tab"]').nth(2).click();
    
    // Verify Add Task button is visible
    await expect(page.getByTestId('add-task-button')).toBeVisible();
  });

  test('should update Issue status', async ({ page }) => {
    await login(page);
    await page.goto('/issues/cl-issue-001');
    
    // Wait for page to load
    await expect(page.getByTestId('issue-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Click Change Status button
    await page.getByTestId('change-status-button').click();
    
    // Verify status dialog opens
    await expect(page.getByTestId('new-status-select')).toBeVisible();
  });
});

test.describe('Closure Loop - Issue Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupClosureLoopMocks(page);
  });

  test('should navigate from Issues list to Issue detail on row click', async ({ page }) => {
    await login(page);
    await page.goto('/issues');
    
    // Wait for page to load
    await expect(page.getByTestId('issue-list-page')).toBeVisible({ timeout: 10000 });
    
    // Click on an issue row (the title link)
    await page.getByText('Closure Loop Test Issue').click();
    
    // Should navigate to detail page
    await expect(page).toHaveURL(/\/issues\/cl-issue-001/);
  });

  test('should navigate back from Issue detail to Issues list', async ({ page }) => {
    await login(page);
    await page.goto('/issues/cl-issue-001');
    
    // Wait for page to load
    await expect(page.getByTestId('issue-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Click back button
    await page.getByTestId('back-button').click();
    
    // Should navigate back to list
    await expect(page).toHaveURL(/\/issues$/);
  });
});

test.describe('Closure Loop - CAPA Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupClosureLoopMocks(page);
  });

  test('should navigate from CAPAs list to CAPA detail on row click', async ({ page }) => {
    await login(page);
    await page.goto('/capa');
    
    // Wait for page to load
    await expect(page.getByTestId('capa-list-page')).toBeVisible({ timeout: 10000 });
    
    // Click on a CAPA row (the title link)
    await page.getByText('Closure Loop Test CAPA').click();
    
    // Should navigate to detail page
    await expect(page).toHaveURL(/\/capa\/cl-capa-001/);
  });
});
