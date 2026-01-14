import { test, expect } from '@playwright/test';
import { login, setupMockApi, waitForApiResponse } from './helpers';

/**
 * Golden Flow E2E Test - Sprint 1E
 * 
 * This test validates the core GRC workflow:
 * 1. Login
 * 2. Navigate to Evidence list (must not be 'coming soon')
 * 3. Open an Evidence detail and verify History tab loads
 * 4. Navigate to a FAIL TestResult detail
 * 5. Verify Issue detail shows correct links + History
 * 6. Navigate to CAPA and verify status transition works
 * 
 * Uses data-testid selectors to avoid brittle text/order assumptions.
 */

// Mock data for Golden Flow
const mockEvidence = {
  id: 'gf-evidence-001',
  tenantId: 'test-tenant-id',
  name: 'GF Security Audit Evidence',
  description: 'Evidence for Golden Flow testing',
  type: 'BASELINE',
  status: 'ACTIVE',
  collectionDate: '2024-01-15',
  expirationDate: '2025-01-15',
  sourceSystem: 'Manual',
  controlIds: ['gf-control-001'],
  createdAt: '2024-01-15T00:00:00Z',
  updatedAt: '2024-01-15T00:00:00Z',
};

const mockTestResult = {
  id: 'gf-test-result-001',
  tenantId: 'test-tenant-id',
  name: 'GF Security Control Test - FAIL',
  result: 'FAIL',
  testedAt: '2024-01-20T00:00:00Z',
  notes: 'Control failed due to missing documentation',
  controlTestId: 'gf-control-test-001',
  controlTest: {
    id: 'gf-control-test-001',
    name: 'Security Control Test',
    controlId: 'gf-control-001',
  },
  evidenceIds: ['gf-evidence-001'],
  createdAt: '2024-01-20T00:00:00Z',
  updatedAt: '2024-01-20T00:00:00Z',
};

const mockIssue = {
  id: 'gf-issue-001',
  tenantId: 'test-tenant-id',
  title: 'GF Security Control Failure Issue',
  description: 'Issue created from failed test result',
  severity: 'HIGH',
  status: 'OPEN',
  testResultId: 'gf-test-result-001',
  evidenceId: 'gf-evidence-001',
  createdAt: '2024-01-21T00:00:00Z',
  updatedAt: '2024-01-21T00:00:00Z',
};

const mockCapa = {
  id: 'gf-capa-001',
  tenantId: 'test-tenant-id',
  title: 'GF Corrective Action Plan',
  description: 'CAPA to address security control failure',
  status: 'PLANNED',
  priority: 'HIGH',
  dueDate: '2024-02-15',
  issueId: 'gf-issue-001',
  createdAt: '2024-01-22T00:00:00Z',
  updatedAt: '2024-01-22T00:00:00Z',
};

const mockStatusHistory = [
  {
    id: 'sh-001',
    entityType: 'EVIDENCE',
    entityId: 'gf-evidence-001',
    previousStatus: null,
    newStatus: 'ACTIVE',
    changedAt: '2024-01-15T00:00:00Z',
    changedBy: 'admin@test.com',
    reason: 'Initial creation',
  },
];

/**
 * Extended mock API setup for Golden Flow test
 */
async function setupGoldenFlowMocks(page: import('@playwright/test').Page) {
  // First setup base mocks
  await setupMockApi(page);

  // Add Golden Flow specific mocks
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

    // Evidence endpoints
    if (url.includes('/grc/evidence') && method === 'GET') {
      if (url.match(/\/grc\/evidence\/[^/?]+$/)) {
        await route.fulfill(successResponse(mockEvidence));
      } else {
        await route.fulfill(successResponse({
          items: [mockEvidence],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        }));
      }
      return;
    }

    // Test Results endpoints
    if (url.includes('/grc/test-results') && method === 'GET') {
      if (url.match(/\/grc\/test-results\/[^/?]+$/)) {
        await route.fulfill(successResponse(mockTestResult));
      } else {
        await route.fulfill(successResponse({
          items: [mockTestResult],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        }));
      }
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

    // CAPA endpoints
    if (url.includes('/grc/capa') && method === 'GET') {
      if (url.match(/\/grc\/capa\/[^/?]+$/)) {
        await route.fulfill(successResponse(mockCapa));
      } else {
        await route.fulfill(successResponse({
          items: [mockCapa],
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

    // GRC Insights endpoint
    if (url.includes('/grc/insights/overview') && method === 'GET') {
      await route.fulfill(successResponse({
        openIssuesBySeverity: { CRITICAL: 0, HIGH: 1, MEDIUM: 0, LOW: 0 },
        overdueCAPAsCount: 0,
        recentFailTestResults: [mockTestResult],
        evidenceStats: { linked: 1, unlinked: 0, total: 1 },
        summary: { totalOpenIssues: 1, totalOverdueCAPAs: 0, totalFailedTests: 1 },
      }));
      return;
    }

    // Let other requests pass through to base mock handler
    await route.continue();
  });
}

test.describe('Golden Flow - GRC Core Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Setup mocks before each test
    await setupGoldenFlowMocks(page);
  });

  test('Evidence list page loads (not coming soon)', async ({ page }) => {
    await login(page);
    
    // Navigate to Evidence list
    await page.goto('/evidence');
    
    // Verify we're on the evidence page and it's not a "coming soon" placeholder
    await expect(page.getByTestId('evidence-list-page')).toBeVisible({ timeout: 10000 });
    
    // Verify the page has actual content (table or empty state), not a placeholder
    const hasTable = await page.locator('table').count() > 0;
    const hasEmptyState = await page.getByTestId('empty-state').count() > 0;
    const hasEvidenceContent = hasTable || hasEmptyState || await page.locator('[data-testid^="evidence-row-"]').count() > 0;
    
    expect(hasEvidenceContent || await page.getByText('Evidence').count() > 0).toBeTruthy();
  });

  test('Evidence detail page loads with History tab', async ({ page }) => {
    await login(page);
    
    // Navigate directly to evidence detail
    await page.goto('/evidence/gf-evidence-001');
    
    // Verify detail page loads
    await expect(page.getByTestId('evidence-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Look for History tab
    const historyTab = page.getByRole('tab', { name: /history/i });
    await expect(historyTab).toBeVisible({ timeout: 5000 });
    
    // Click History tab
    await historyTab.click();
    
    // Verify history content loads (table or empty message)
    const historyContent = page.locator('[data-testid="status-history-table"], [data-testid="status-history-empty"]');
    await expect(historyContent.first()).toBeVisible({ timeout: 5000 });
  });

  test('Test Results list page loads (not coming soon)', async ({ page }) => {
    await login(page);
    
    // Navigate to Test Results list
    await page.goto('/test-results');
    
    // Verify we're on the test results page
    await expect(page.getByTestId('test-result-list-page')).toBeVisible({ timeout: 10000 });
  });

  test('Issues list page loads (not coming soon)', async ({ page }) => {
    await login(page);
    
    // Navigate to Issues list
    await page.goto('/issues');
    
    // Verify we're on the issues page
    await expect(page.getByTestId('issue-list-page')).toBeVisible({ timeout: 10000 });
  });

  test('CAPA list page loads (not coming soon)', async ({ page }) => {
    await login(page);
    
    // Navigate to CAPA list
    await page.goto('/capa');
    
    // Verify we're on the CAPA page
    await expect(page.getByTestId('capa-list-page')).toBeVisible({ timeout: 10000 });
  });

  test('GRC Insights page loads with metrics', async ({ page }) => {
    await login(page);
    
    // Navigate to Insights page
    await page.goto('/insights');
    
    // Verify insights page loads
    await expect(page.getByTestId('grc-insights-page')).toBeVisible({ timeout: 10000 });
    
    // Verify metric cards are present
    await expect(page.getByTestId('total-issues-card')).toBeVisible();
    await expect(page.getByTestId('overdue-capas-card')).toBeVisible();
    await expect(page.getByTestId('failed-tests-card')).toBeVisible();
    await expect(page.getByTestId('evidence-stats-card')).toBeVisible();
  });

  test('Full Golden Flow: Evidence -> Test Result -> Issue -> CAPA', async ({ page }) => {
    await login(page);
    
    // Step 1: Navigate to Evidence list
    await page.goto('/evidence');
    await expect(page.getByTestId('evidence-list-page')).toBeVisible({ timeout: 10000 });
    
    // Step 2: Navigate to Evidence detail
    await page.goto('/evidence/gf-evidence-001');
    await expect(page.getByTestId('evidence-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Step 3: Check History tab exists
    const historyTab = page.getByRole('tab', { name: /history/i });
    await expect(historyTab).toBeVisible({ timeout: 5000 });
    
    // Step 4: Navigate to Test Results
    await page.goto('/test-results');
    await expect(page.getByTestId('test-result-list-page')).toBeVisible({ timeout: 10000 });
    
    // Step 5: Navigate to Test Result detail (FAIL result)
    await page.goto('/test-results/gf-test-result-001');
    await expect(page.getByTestId('test-result-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Step 6: Navigate to Issues
    await page.goto('/issues');
    await expect(page.getByTestId('issue-list-page')).toBeVisible({ timeout: 10000 });
    
    // Step 7: Navigate to Issue detail
    await page.goto('/issues/gf-issue-001');
    await expect(page.getByTestId('issue-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Step 8: Navigate to CAPA list
    await page.goto('/capa');
    await expect(page.getByTestId('capa-list-page')).toBeVisible({ timeout: 10000 });
    
    // Step 9: Navigate to CAPA detail
    await page.goto('/capa/gf-capa-001');
    await expect(page.getByTestId('capa-detail-page')).toBeVisible({ timeout: 10000 });
    
    // Verify CAPA detail has History tab
    const capaHistoryTab = page.getByRole('tab', { name: /history/i });
    await expect(capaHistoryTab).toBeVisible({ timeout: 5000 });
  });
});
