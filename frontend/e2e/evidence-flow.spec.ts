import { test, expect } from '@playwright/test';
import { login, setupMockApi } from './helpers';

/**
 * Evidence Golden Flow E2E Test
 * 
 * This test validates the Evidence workflow:
 * 1. Login
 * 2. Navigate to Evidence list
 * 3. Create new Evidence
 * 4. Navigate to Evidence detail
 * 5. Verify tabs (Overview, Links, Attachments, History)
 * 6. Navigate to Issue detail and verify Evidence in Links tab
 * 
 * Uses data-testid selectors to avoid brittle text/order assumptions.
 */

// Mock data for Evidence flow
const mockEvidence = {
  id: 'ef-evidence-001',
  tenantId: 'test-tenant-id',
  name: 'Evidence Flow Test Evidence',
  description: 'Evidence created for E2E testing',
  type: 'DOCUMENT',
  sourceType: 'MANUAL',
  status: 'DRAFT',
  collectionDate: '2024-01-15',
  expirationDate: '2025-01-15',
  createdAt: '2024-01-15T00:00:00Z',
  updatedAt: '2024-01-15T00:00:00Z',
};

const mockIssue = {
  id: 'ef-issue-001',
  tenantId: 'test-tenant-id',
  title: 'Test Issue for Evidence Flow',
  description: 'Issue for testing evidence linkage',
  type: 'internal_audit',
  severity: 'MEDIUM',
  status: 'OPEN',
  dueDate: '2024-02-28',
  createdAt: '2024-01-21T00:00:00Z',
  updatedAt: '2024-01-21T00:00:00Z',
};

const mockControl = {
  id: 'ef-control-001',
  tenantId: 'test-tenant-id',
  name: 'Test Control for Evidence Flow',
  code: 'CTRL-EF-001',
  description: 'Control for testing evidence linkage',
  type: 'detective',
  implementationType: 'manual',
  status: 'implemented',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockLinkedEvidence = {
  id: 'link-001',
  evidenceId: 'ef-evidence-001',
  evidence: mockEvidence,
  evidenceType: 'BASELINE',
  createdAt: '2024-01-20T00:00:00Z',
};

const mockStatusHistory = [
  {
    id: 'sh-001',
    entityType: 'EVIDENCE',
    entityId: 'ef-evidence-001',
    previousStatus: null,
    newStatus: 'DRAFT',
    changedAt: '2024-01-15T00:00:00Z',
    changedBy: 'admin@test.com',
    reason: 'Initial creation',
  },
];

/**
 * Extended mock API setup for Evidence Flow test
 */
async function setupEvidenceFlowMocks(page: import('@playwright/test').Page) {
  // First setup base mocks
  await setupMockApi(page);

  // Add Evidence Flow specific mocks
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

    // Evidence endpoints
    if (url.includes('/grc/evidence') && !url.includes('/grc/issues/') && !url.includes('/grc/controls/')) {
      // POST - Create evidence
      if (method === 'POST' && url.match(/\/grc\/evidence\/?$/)) {
        const newEvidence = {
          ...mockEvidence,
          id: `ef-evidence-${Date.now()}`,
          name: 'Newly Created Evidence',
        };
        await route.fulfill(createdResponse(newEvidence));
        return;
      }

      // GET - List or detail
      if (method === 'GET') {
        // Evidence detail with linked controls
        if (url.match(/\/grc\/evidence\/[^/?]+\/controls$/)) {
          await route.fulfill(successResponse([{
            id: 'link-ctrl-001',
            controlId: mockControl.id,
            control: mockControl,
            createdAt: '2024-01-20T00:00:00Z',
          }]));
          return;
        }

        // Evidence detail with linked issues
        if (url.match(/\/grc\/evidence\/[^/?]+\/issues$/)) {
          await route.fulfill(successResponse([{
            id: 'link-issue-001',
            issueId: mockIssue.id,
            issue: mockIssue,
            createdAt: '2024-01-20T00:00:00Z',
          }]));
          return;
        }

        // Evidence detail with linked test results
        if (url.match(/\/grc\/evidence\/[^/?]+\/test-results$/)) {
          await route.fulfill(successResponse([]));
          return;
        }

        // Evidence attachments
        if (url.match(/\/grc\/evidence\/[^/?]+\/attachments$/)) {
          await route.fulfill(successResponse([]));
          return;
        }

        // Single evidence detail
        if (url.match(/\/grc\/evidence\/[^/?]+$/)) {
          await route.fulfill(successResponse(mockEvidence));
          return;
        }

        // Evidence list
        await route.fulfill(successResponse({
          items: [mockEvidence],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        }));
        return;
      }
    }

    // Issue with linked evidence
    if (url.match(/\/grc\/issues\/[^/]+\/evidence/) && method === 'GET') {
      await route.fulfill(successResponse([mockLinkedEvidence]));
      return;
    }

    // Control with linked evidence
    if (url.match(/\/grc\/controls\/[^/]+\/evidences/) && method === 'GET') {
      await route.fulfill(successResponse([mockLinkedEvidence]));
      return;
    }

    // Issues endpoints
    if (url.includes('/grc/issues') && method === 'GET') {
      if (url.match(/\/grc\/issues\/[^/?]+$/)) {
        await route.fulfill(successResponse(mockIssue));
      } else {
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

    // Controls endpoints
    if (url.includes('/grc/controls') && method === 'GET') {
      if (url.match(/\/grc\/controls\/[^/?]+$/)) {
        await route.fulfill(successResponse(mockControl));
      } else {
        await route.fulfill(successResponse({
          items: [mockControl],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        }));
      }
      return;
    }

    // Status History endpoint
    if (url.includes('/grc/status-history/by-entity') && method === 'GET') {
      await route.fulfill(successResponse(mockStatusHistory));
      return;
    }

    // Attachments endpoint (generic)
    if (url.includes('/grc/attachments') && method === 'GET') {
      await route.fulfill(successResponse([]));
      return;
    }

    // Let other requests pass through to base mock handler
    await route.continue();
  });
}

test.describe('Evidence Golden Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Setup mocks before each test
    await setupEvidenceFlowMocks(page);
  });

  test('Evidence list page loads with create button', async ({ page }) => {
    await login(page);
    
    // Navigate to Evidence list
    await page.goto('/evidence');
    
    // Verify we're on the evidence page
    await expect(page.getByTestId('evidence-list-page')).toBeVisible({ timeout: 10000 });
    
    // Verify create button is present
    await expect(page.getByTestId('create-evidence-button')).toBeVisible({ timeout: 5000 });
  });

  test('Evidence create dialog opens and submits', async ({ page }) => {
    await login(page);
    
    // Navigate to Evidence list
    await page.goto('/evidence');
    await expect(page.getByTestId('evidence-list-page')).toBeVisible({ timeout: 10000 });
    
    // Click create button
    await page.getByTestId('create-evidence-button').click();
    
    // Verify dialog opens
    await expect(page.getByTestId('create-evidence-dialog')).toBeVisible({ timeout: 5000 });
    
    // Fill in the name field
    await page.getByTestId('evidence-name-input').locator('input').fill('Test Evidence from Playwright');
    
    // Submit the form
    await page.getByTestId('submit-create-evidence-button').click();
    
    // Dialog should close after successful creation
    await expect(page.getByTestId('create-evidence-dialog')).not.toBeVisible({ timeout: 5000 });
  });

  test('Evidence detail page loads with all tabs', async ({ page }) => {
    await login(page);
    
    // Navigate directly to evidence detail
    await page.goto('/evidence/ef-evidence-001');
    
    // Verify detail page loads
    await expect(page.getByTestId('evidence-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Verify Overview tab is present
    await expect(page.getByTestId('overview-tab')).toBeVisible({ timeout: 5000 });
    
    // Verify Links tab is present
    await expect(page.getByTestId('links-tab')).toBeVisible({ timeout: 5000 });
    
    // Verify Attachments tab is present
    await expect(page.getByTestId('attachments-tab')).toBeVisible({ timeout: 5000 });
    
    // Verify History tab is present
    await expect(page.getByTestId('history-tab')).toBeVisible({ timeout: 5000 });
  });

  test('Evidence detail Links tab shows linked entities', async ({ page }) => {
    await login(page);
    
    // Navigate to evidence detail
    await page.goto('/evidence/ef-evidence-001');
    await expect(page.getByTestId('evidence-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Click Links tab
    await page.getByTestId('links-tab').click();
    
    // Verify Links panel is visible
    await expect(page.getByTestId('evidence-panel-links')).toBeVisible({ timeout: 5000 });
  });

  test('Evidence detail Attachments tab loads', async ({ page }) => {
    await login(page);
    
    // Navigate to evidence detail
    await page.goto('/evidence/ef-evidence-001');
    await expect(page.getByTestId('evidence-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Click Attachments tab
    await page.getByTestId('attachments-tab').click();
    
    // Verify Attachments panel is visible
    await expect(page.getByTestId('evidence-panel-attachments')).toBeVisible({ timeout: 5000 });
  });

  test('Evidence detail History tab shows status history', async ({ page }) => {
    await login(page);
    
    // Navigate to evidence detail
    await page.goto('/evidence/ef-evidence-001');
    await expect(page.getByTestId('evidence-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Click History tab
    await page.getByTestId('history-tab').click();
    
    // Verify history content loads (table or empty message)
    const historyContent = page.locator('[data-testid="status-history-table"], [data-testid="status-history-empty"]');
    await expect(historyContent.first()).toBeVisible({ timeout: 5000 });
  });

  test('Issue detail Links tab shows linked evidence', async ({ page }) => {
    await login(page);
    
    // Navigate to issue detail
    await page.goto('/issues/ef-issue-001');
    await expect(page.getByTestId('issue-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Click Links tab
    const linksTab = page.getByRole('tab', { name: /links/i });
    await linksTab.click();
    
    // Verify linked evidence section is visible
    await expect(page.getByTestId('linked-evidence-section')).toBeVisible({ timeout: 5000 });
  });

  test('Control detail Evidence tab shows linked evidence', async ({ page }) => {
    await login(page);
    
    // Navigate to control detail
    await page.goto('/controls/ef-control-001');
    await expect(page.getByTestId('control-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Click Evidence tab
    const evidenceTab = page.getByRole('tab', { name: /evidence/i });
    await evidenceTab.click();
    
    // Verify evidence tab content is visible (table or empty state)
    const evidenceContent = page.locator('[data-testid="linked-grc-evidences-table"], [data-testid="linked-grc-evidences-empty"]');
    await expect(evidenceContent.first()).toBeVisible({ timeout: 5000 });
  });

  test('Full Evidence Flow: List -> Create -> Detail -> Tabs', async ({ page }) => {
    await login(page);
    
    // Step 1: Navigate to Evidence list
    await page.goto('/evidence');
    await expect(page.getByTestId('evidence-list-page')).toBeVisible({ timeout: 10000 });
    
    // Step 2: Verify create button exists
    await expect(page.getByTestId('create-evidence-button')).toBeVisible({ timeout: 5000 });
    
    // Step 3: Navigate to Evidence detail
    await page.goto('/evidence/ef-evidence-001');
    await expect(page.getByTestId('evidence-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Step 4: Check all tabs exist
    await expect(page.getByTestId('overview-tab')).toBeVisible();
    await expect(page.getByTestId('links-tab')).toBeVisible();
    await expect(page.getByTestId('attachments-tab')).toBeVisible();
    await expect(page.getByTestId('history-tab')).toBeVisible();
    
    // Step 5: Navigate through tabs
    await page.getByTestId('links-tab').click();
    await expect(page.getByTestId('evidence-panel-links')).toBeVisible({ timeout: 5000 });
    
    await page.getByTestId('attachments-tab').click();
    await expect(page.getByTestId('evidence-panel-attachments')).toBeVisible({ timeout: 5000 });
    
    await page.getByTestId('history-tab').click();
    const historyContent = page.locator('[data-testid="status-history-table"], [data-testid="status-history-empty"]');
    await expect(historyContent.first()).toBeVisible({ timeout: 5000 });
  });

  test('Evidence tenant isolation - API calls include tenant header', async ({ page }) => {
    // This test verifies that Evidence API calls include the x-tenant-id header
    // which is critical for multi-tenant isolation
    
    const apiCallsWithTenantHeader: string[] = [];
    
    // Intercept all API calls and check for tenant header
    await page.route('**/grc/evidence**', async (route) => {
      const request = route.request();
      const headers = request.headers();
      const tenantId = headers['x-tenant-id'];
      
      if (tenantId) {
        apiCallsWithTenantHeader.push(`${request.method()} ${request.url()} - tenant: ${tenantId}`);
      }
      
      // Continue with mock response
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              items: [mockEvidence],
              total: 1,
              page: 1,
              pageSize: 20,
              totalPages: 1,
            },
          }),
        });
      } else {
        await route.continue();
      }
    });
    
    await login(page);
    
    // Navigate to Evidence list - this should trigger API call with tenant header
    await page.goto('/evidence');
    await expect(page.getByTestId('evidence-list-page')).toBeVisible({ timeout: 10000 });
    
    // Wait for API calls to complete
    await page.waitForTimeout(1000);
    
    // Verify that at least one API call included the tenant header
    expect(apiCallsWithTenantHeader.length).toBeGreaterThan(0);
    
    // Verify all captured calls have a valid tenant ID (UUID format)
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    for (const call of apiCallsWithTenantHeader) {
      expect(call).toMatch(uuidRegex);
    }
  });
});
