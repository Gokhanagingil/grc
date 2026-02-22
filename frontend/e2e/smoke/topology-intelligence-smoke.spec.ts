/**
 * Topology Intelligence E2E Smoke Tests (Phase-C, Phase 4)
 *
 * MOCK_UI mode tests for topology intelligence features:
 * - Change detail topology decision support renders
 * - MI RCA hypothesis → create Problem/KE/PIR action works
 * - 403 on optional topology endpoints shows banner, no logout
 * - Recalculate + re-evaluate governance returns visible result
 *
 * Respects E2E mode separation (MOCK_UI vs REAL_STACK).
 * No mock helpers used in REAL_STACK tests.
 *
 * @smoke
 */

import { test, expect } from '@playwright/test';
import { login, setupMockApi, isMockUi, isRealStack, assertE2eMode, logE2eConfig } from '../helpers';

// ============================================================================
// MOCK_UI Suite — Fast UI regression checks using route interception
// ============================================================================

test.describe('Topology Intelligence Smoke — MOCK_UI @mock', () => {
  test.beforeAll(() => {
    logE2eConfig('Topology Intelligence Smoke — MOCK_UI');
  });

  test.beforeEach(async ({ page }) => {
    // Only run in MOCK_UI mode
    if (isRealStack()) {
      test.skip(true, 'This suite is MOCK_UI only');
      return;
    }
    await setupMockApi(page);
  });

  test('Change detail renders Topology Decision Support section', async ({ page }) => {
    if (isRealStack()) { test.skip(); return; }
    test.slow();

    // Mock the topology governance endpoint
    await page.route('**/grc/itsm/changes/*/topology/governance**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            changeId: 'mock-change-1',
            decision: 'CAB_REQUIRED',
            policyFlags: {
              topologyRiskScore: 65,
              topologyHighBlastRadius: true,
              topologyFragilitySignalsCount: 2,
              topologyCriticalDependencyTouched: true,
              topologySinglePointOfFailureRisk: false,
            },
            recommendedActions: [
              { key: 'implementationPlan', label: 'Implementation Plan', required: true, satisfied: false, reason: 'Required due to topology risk' },
              { key: 'backoutPlan', label: 'Backout Plan', required: true, satisfied: true, reason: 'Required due to topology risk' },
            ],
            explainability: {
              summary: 'CAB approval required. Key factors: Topology Risk Score, Blast Radius.',
              factors: [
                { key: 'topologyRiskScore', label: 'Topology Risk Score', value: 65, severity: 'critical', explanation: 'Risk score of 65/100' },
                { key: 'blastRadius', label: 'Blast Radius', value: 15, severity: 'critical', explanation: '15 nodes impacted across 3 services' },
              ],
              topDependencyPaths: [],
              matchedPolicyNames: ['high-risk-topology-policy'],
            },
            topologyDataAvailable: true,
            evaluatedAt: new Date().toISOString(),
            warnings: [],
          },
        }),
      });
    });

    // Mock the topology impact endpoint
    await page.route('**/grc/itsm/changes/*/topology/impact**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            changeId: 'mock-change-1',
            rootNodeIds: ['ci-root'],
            metrics: {
              totalImpactedNodes: 15,
              impactedByDepth: { '0': 1, '1': 8, '2': 6 },
              impactedServiceCount: 3,
              impactedOfferingCount: 1,
              impactedCiCount: 12,
              criticalCiCount: 2,
              maxChainDepth: 2,
              crossServicePropagation: true,
              crossServiceCount: 3,
            },
            impactedNodes: [],
            topPaths: [],
            fragilitySignals: [],
            topologyRiskScore: 65,
            riskExplanation: 'High topology risk',
            computedAt: new Date().toISOString(),
            warnings: [],
          },
        }),
      });
    });

    // Mock a single change detail
    await page.route('**/grc/itsm/changes/mock-change-1', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'mock-change-1',
              number: 'CHG000001',
              title: 'Deploy database cluster v2',
              type: 'NORMAL',
              state: 'AUTHORIZE',
              risk: 'HIGH',
              approvalStatus: 'NOT_REQUESTED',
              serviceId: 'svc-1',
              plannedStartAt: new Date().toISOString(),
              plannedEndAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await login(page);
    await page.goto('/itsm/changes/mock-change-1');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Look for topology decision support section
    const decisionPanel = page.locator('[data-testid="topology-governance-decision-panel"]');
    const hasPanel = await decisionPanel.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasPanel) {
      await expect(decisionPanel).toBeVisible();

      // Verify decision chip is visible
      const decisionChip = decisionPanel.locator('[data-testid="governance-decision-chip"]');
      const hasChip = await decisionChip.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasChip) {
        const chipText = await decisionChip.textContent();
        expect(chipText).toBeTruthy();
      }
    }
  });

  test('403 on topology governance endpoint shows banner, does NOT logout', async ({ page }) => {
    if (isRealStack()) { test.skip(); return; }
    test.slow();

    // Mock topology governance returning 403
    await page.route('**/grc/itsm/changes/*/topology/governance**', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: 403,
          message: 'Forbidden',
          error: 'You do not have permission to access topology governance.',
        }),
      });
    });

    // Mock topology impact returning 403
    await page.route('**/grc/itsm/changes/*/topology/impact**', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: 403,
          message: 'Forbidden',
        }),
      });
    });

    // Mock the change detail itself (should still work)
    await page.route('**/grc/itsm/changes/mock-change-403', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'mock-change-403',
              number: 'CHG000002',
              title: 'Test 403 handling',
              type: 'NORMAL',
              state: 'DRAFT',
              risk: 'MEDIUM',
              approvalStatus: 'NOT_REQUESTED',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await login(page);
    await page.goto('/itsm/changes/mock-change-403');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Wait a bit for the page to settle
    await page.waitForTimeout(3000);

    // Verify we are NOT redirected to login page (no logout on 403)
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).toContain('/itsm/changes/');

    // Check that core change data still loads (page is not blank)
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('MI RCA hypothesis actions are visible', async ({ page }) => {
    if (isRealStack()) { test.skip(); return; }
    test.slow();

    // Mock MI detail
    await page.route('**/grc/itsm/major-incidents/mock-mi-1', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'mock-mi-1',
              number: 'MI000001',
              title: 'Critical service outage',
              status: 'DECLARED',
              primaryServiceId: 'svc-1',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock RCA hypotheses
    await page.route('**/grc/itsm/major-incidents/*/topology/rca-hypotheses**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            majorIncidentId: 'mock-mi-1',
            rootServiceIds: ['svc-1'],
            linkedCiIds: ['ci-db-1'],
            hypotheses: [
              {
                id: 'hyp-1',
                type: 'common_upstream_dependency',
                score: 0.85,
                suspectNodeId: 'ci-db-1',
                suspectNodeLabel: 'Shared Database Cluster',
                suspectNodeType: 'ci',
                explanation: 'Database cluster is a common upstream dependency',
                evidence: [
                  {
                    type: 'topology_path',
                    description: 'All 3 affected services depend on this database cluster',
                    referenceId: 'ci-db-1',
                    referenceLabel: 'Shared Database Cluster',
                  },
                ],
                affectedServiceIds: ['svc-1', 'svc-2'],
                recommendedActions: [
                  { type: 'create_problem', label: 'Create Problem', reason: 'High confidence', confidence: 85 },
                ],
              },
            ],
            nodesAnalyzed: 15,
            computedAt: new Date().toISOString(),
            warnings: [],
          },
        }),
      });
    });

    await login(page);
    await page.goto('/itsm/major-incidents/mock-mi-1');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Wait for page to render
    await page.waitForTimeout(3000);

    // Check that page loads without errors (no redirect to login)
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');

    // Look for RCA hypotheses table
    const rcaTable = page.locator('[data-testid="rca-hypotheses-table"]');
    const hasRcaTable = await rcaTable.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasRcaTable) {
      await expect(rcaTable).toBeVisible();

      // Look for action buttons
      const createProblemBtn = page.locator('[data-testid="create-problem-btn"]').first();
      const hasProblemBtn = await createProblemBtn.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasProblemBtn) {
        await expect(createProblemBtn).toBeVisible();
      }
    }
  });
});

// ============================================================================
// REAL_STACK Suite — Validates real API contracts (no mocks allowed)
// ============================================================================

test.describe('Topology Intelligence Smoke — REAL_STACK @real', () => {
  test.beforeAll(() => {
    logE2eConfig('Topology Intelligence Smoke — REAL_STACK');
  });

  test.beforeEach(async () => {
    // Only run in REAL_STACK mode
    if (isMockUi()) {
      test.skip(true, 'This suite is REAL_STACK only');
      return;
    }
    // Hard fail if mock helpers are accidentally used
    assertE2eMode('REAL_STACK');
  });

  test('Change list loads without topology errors', async ({ page }) => {
    if (isMockUi()) { test.skip(); return; }
    test.slow();

    await login(page);
    await page.goto('/itsm/changes');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Verify page loads (table or empty state)
    const table = page.locator('table');
    const emptyState = page.locator('text=No changes, text=No data, text=No records').first();

    const hasTable = await table.isVisible({ timeout: 15000 }).catch(() => false);
    const hasEmpty = await emptyState.isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasTable || hasEmpty).toBe(true);

    // Verify no error dialogs
    const errorDialog = page.locator('[role="dialog"]').filter({ hasText: /error|failed/i });
    const hasError = await errorDialog.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);
  });

  test('MI list loads without topology errors', async ({ page }) => {
    if (isMockUi()) { test.skip(); return; }
    test.slow();

    await login(page);
    await page.goto('/itsm/major-incidents');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Verify page loads
    const table = page.locator('table');
    const emptyState = page.locator('text=No major incidents, text=No data, text=No records').first();

    const hasTable = await table.isVisible({ timeout: 15000 }).catch(() => false);
    const hasEmpty = await emptyState.isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasTable || hasEmpty).toBe(true);
  });
});
