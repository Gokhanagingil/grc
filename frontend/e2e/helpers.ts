import { Page, expect } from '@playwright/test';

/**
 * Test credentials - can be overridden via environment variables
 */
export const TEST_CREDENTIALS = {
  email: process.env.E2E_EMAIL || 'admin@grc-platform.local',
  password: process.env.E2E_PASSWORD || 'TestPassword123!',
};

/**
 * Setup API mocking for E2E tests when E2E_MOCK_API=1
 * This allows tests to run without a real backend service
 * 
 * CRITICAL: Only intercepts API requests (xhr/fetch resource types)
 * Never intercepts HTML, CSS, JS, images, fonts, or other static assets
 */
export async function setupMockApi(page: Page) {
  const mockEnabled = process.env.E2E_MOCK_API === '1';
  if (!mockEnabled) {
    return;
  }

  const isCI = process.env.CI === 'true' || process.env.CI === '1';
  const mockToken = 'mock-access-token-12345';

  // Mock admin user data
  const mockAdminUser = {
    id: 1,
    username: TEST_CREDENTIALS.email,
    email: TEST_CREDENTIALS.email,
    firstName: 'Admin',
    lastName: 'User',
    department: 'IT',
    role: 'admin',
    tenantId: 'test-tenant-id',
  };

  // Mock onboarding context with policy (OnboardingContextWithPolicy shape)
  const mockOnboardingContext = {
    context: {
      status: 'active',
      schemaVersion: 1,
      policySetVersion: null,
      activeSuites: ['GRC_SUITE'],
      enabledModules: {
        GRC_SUITE: ['risk', 'policy', 'audit', 'issue', 'capa', 'evidence', 'control'],
        ITSM_SUITE: [],
      },
      activeFrameworks: ['ISO27001'],
      maturity: 'foundational',
      metadata: {
        initializedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
      },
    },
    policy: {
      disabledFeatures: [],
      warnings: [],
      metadata: {},
    },
  };

  // Helper to return success response with data envelope
  const successResponse = (data: unknown) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data }),
  });

  // Helper to check if URL matches API endpoint pattern
  const isApiUrl = (url: string): boolean => {
    const apiSegments = ['/auth/', '/onboarding/', '/users/', '/admin/', '/grc/', '/audit/', '/api/', '/audit-logs', '/health/'];
    return apiSegments.some(segment => url.includes(segment));
  };

  // Helper to log mock interception (only in CI)
  const logMock = (method: string, url: string, intercepted: boolean) => {
    if (isCI && isApiUrl(url)) {
      console.log(`[mock] ${intercepted ? '✓' : '✗'} ${method} ${url}`);
    }
  };

  // Intercept all requests and check if they match our patterns
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    const method = request.method();
    const resourceType = request.resourceType();

    // CRITICAL: Only intercept xhr/fetch requests, never static assets
    if (resourceType !== 'xhr' && resourceType !== 'fetch') {
      await route.continue();
      return;
    }

    // Check if this is an API URL
    if (!isApiUrl(url)) {
      await route.continue();
      return;
    }

    // Handle auth/login - POST
    if (url.includes('/auth/login') && method === 'POST') {
      logMock(method, url, true);
      await route.fulfill(successResponse({
        accessToken: mockToken,
        token: mockToken, // Legacy token field
        refreshToken: 'mock-refresh-token-12345',
        user: mockAdminUser,
      }));
      return;
    }

    // Handle auth/me - GET
    if (url.includes('/auth/me') && method === 'GET') {
      logMock(method, url, true);
      await route.fulfill(successResponse(mockAdminUser));
      return;
    }

    // Handle users/me - GET
    if (url.includes('/users/me') && method === 'GET') {
      logMock(method, url, true);
      await route.fulfill(successResponse(mockAdminUser));
      return;
    }

    // Handle onboarding/context - GET
    if (url.includes('/onboarding/context') && method === 'GET') {
      logMock(method, url, true);
      await route.fulfill(successResponse(mockOnboardingContext));
      return;
    }

    // Handle audit-logs - GET
    if (url.includes('/audit-logs') && method === 'GET') {
      logMock(method, url, true);
      await route.fulfill(successResponse([]));
      return;
    }

    // Handle grc/issues/:id/controls - GET (linked controls for an issue)
    // MUST be before the generic /grc/controls handler
    if (url.match(/\/grc\/issues\/[^/]+\/controls/) && method === 'GET') {
      logMock(method, url, true);
      // Return empty array of linked controls (not paginated)
      await route.fulfill(successResponse([]));
      return;
    }

    // Handle grc/issues/:id/test-results - GET (linked test results for an issue)
    // MUST be before the generic /grc/test-results handler
    if (url.match(/\/grc\/issues\/[^/]+\/test-results/) && method === 'GET') {
      logMock(method, url, true);
      // Return empty array of linked test results (not paginated)
      await route.fulfill(successResponse([]));
      return;
    }

    // Handle grc/issues/:id/evidence - GET (linked evidence for an issue)
    // MUST be before the generic /grc/evidence handler
    if (url.match(/\/grc\/issues\/[^/]+\/evidence/) && method === 'GET') {
      logMock(method, url, true);
      // Return empty array of linked evidence (not paginated)
      await route.fulfill(successResponse([]));
      return;
    }

    // Handle grc/controls - GET (list)
    if (url.includes('/grc/controls') && method === 'GET') {
      logMock(method, url, true);
      
      // Mock controls for list page tests
      const mockControls = [
        {
          id: 'mock-control-1',
          tenantId: 'test-tenant-id',
          name: 'Access Control Review',
          code: 'CTRL-001',
          description: 'Quarterly review of access controls',
          type: 'detective',
          implementationType: 'manual',
          status: 'implemented',
          frequency: 'quarterly',
          ownerUserId: '1',
          owner: { id: '1', email: 'admin@test.com', firstName: 'Admin', lastName: 'User' },
          effectiveDate: '2024-01-01',
          lastTestedDate: '2024-10-15',
          nextTestDate: '2025-01-15',
          lastTestResult: 'PASS',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-10-15T00:00:00Z',
          isDeleted: false,
        },
        {
          id: 'mock-control-2',
          tenantId: 'test-tenant-id',
          name: 'GF Security Policy Enforcement',
          code: 'CTRL-002',
          description: 'Automated enforcement of security policies',
          type: 'preventive',
          implementationType: 'automated',
          status: 'implemented',
          frequency: 'continuous',
          ownerUserId: '1',
          owner: { id: '1', email: 'admin@test.com', firstName: 'Admin', lastName: 'User' },
          effectiveDate: '2024-01-01',
          lastTestedDate: '2024-11-01',
          nextTestDate: '2025-02-01',
          lastTestResult: 'PASS',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-11-01T00:00:00Z',
          isDeleted: false,
        },
      ];

      // Check if this is a detail endpoint (e.g., /grc/controls/mock-control-1)
      if (url.match(/\/grc\/controls\/[^/?]+$/)) {
        await route.fulfill(successResponse(mockControls[0]));
      } else {
        // List endpoint
        await route.fulfill(successResponse({
          items: mockControls,
          total: mockControls.length,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        }));
      }
      return;
    }

    // Handle grc/audits - GET (list, detail, can/create, distinct/department, findings, requirements, reports, permissions)
    if (url.includes('/grc/audits') && method === 'GET') {
      logMock(method, url, true);
      
      // Mock audit for detail page tests
      const mockAudit = {
        id: 'mock-audit-1',
        name: 'Mock Audit for E2E Testing',
        description: 'This is a mock audit for smoke testing',
        auditType: 'internal',
        status: 'in_progress',
        riskLevel: 'medium',
        department: 'IT',
        ownerUserId: '1',
        leadAuditorId: '1',
        plannedStartDate: '2024-01-01',
        plannedEndDate: '2024-12-31',
        actualStartDate: null,
        actualEndDate: null,
        scope: 'Test scope',
        objectives: 'Test objectives',
        methodology: 'Test methodology',
        findingsSummary: null,
        recommendations: null,
        conclusion: null,
        owner: { firstName: 'Admin', lastName: 'User', email: 'admin@test.com' },
        leadAuditor: { firstName: 'Admin', lastName: 'User', email: 'admin@test.com' },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      if (url.includes('/can/create')) {
        await route.fulfill(successResponse({ allowed: true }));
      } else if (url.includes('/distinct/department')) {
        await route.fulfill(successResponse([]));
      } else if (url.includes('/permissions')) {
        // Audit permissions endpoint - ensure arrays are present
        await route.fulfill(successResponse({
          read: true,
          write: true,
          delete: false,
          maskedFields: [],
          deniedFields: [],
        }));
      } else if (url.includes('/findings')) {
        // Audit findings endpoint
        await route.fulfill(successResponse([]));
      } else if (url.includes('/requirements')) {
        // Audit requirements endpoint
        await route.fulfill(successResponse([]));
      } else if (url.includes('/reports')) {
        // Audit reports endpoint
        await route.fulfill(successResponse([]));
      } else if (url.match(/\/grc\/audits\/[^/]+$/)) {
        // Single audit detail endpoint (e.g., /grc/audits/mock-audit-1)
        await route.fulfill(successResponse(mockAudit));
      } else {
        // List endpoint - include mock audit for smoke test
        await route.fulfill(successResponse({
          audits: [mockAudit],
          pagination: { total: 1, page: 1, pageSize: 10, totalPages: 1 },
        }));
      }
      return;
    }

    // Handle tenants - GET
    if (url.includes('/tenants') && method === 'GET' && !url.includes('/tenants/')) {
      logMock(method, url, true);
      await route.fulfill(successResponse([]));
      return;
    }

    // Handle users/statistics/overview - GET
    if (url.includes('/users/statistics/overview') && method === 'GET') {
      logMock(method, url, true);
      await route.fulfill(successResponse({
        total: 0,
        active: 0,
        inactive: 0,
      }));
      return;
    }

    // Handle health endpoints - GET (live, db, auth, detailed)
    // Use pathname-based matching for reliability (avoids URL differences)
    const pathname = new URL(url).pathname;
    if (method === 'GET' && (
      pathname === '/health/live' || 
      pathname === '/health/db' || 
      pathname === '/health/auth' || 
      pathname === '/health/detailed'
    )) {
      logMock(method, url, true);
      if (pathname === '/health/detailed') {
        await route.fulfill(successResponse({
          status: 'OK',
          uptime: 1000,
          timestamp: new Date().toISOString(),
          environment: 'test',
        }));
      } else {
        // /health/live, /health/db, /health/auth all return same format
        await route.fulfill(successResponse({
          status: 'OK',
          message: 'Service is healthy',
        }));
      }
      return;
    }

    // Handle settings/system - GET
    if (url.includes('/settings/system') && method === 'GET') {
      logMock(method, url, true);
      await route.fulfill(successResponse({
        settings: [],
      }));
      return;
    }

    // Handle dashboard/overview - GET
    if (url.includes('/dashboard/overview') && method === 'GET') {
      logMock(method, url, true);
      await route.fulfill(successResponse({
        risks: { total: 0, open: 0, high: 0, overdue: 0, top5OpenRisks: [] },
        compliance: { total: 0, pending: 0, completed: 0, overdue: 0 },
        policies: { total: 0, active: 0, draft: 0 },
        incidents: { total: 0, open: 0, closed: 0, resolved: 0 },
        users: { total: 0, admins: 0, managers: 0 },
      }));
      return;
    }

    // Handle dashboard/risk-trends - GET
    if (url.includes('/dashboard/risk-trends') && method === 'GET') {
      logMock(method, url, true);
      await route.fulfill(successResponse([]));
      return;
    }

    // Handle dashboard/compliance-by-regulation - GET
    if (url.includes('/dashboard/compliance-by-regulation') && method === 'GET') {
      logMock(method, url, true);
      await route.fulfill(successResponse([]));
      return;
    }

    // Handle platform/modules/enabled - GET
    if (url.includes('/platform/modules/enabled') && method === 'GET') {
      logMock(method, url, true);
      await route.fulfill(successResponse(['risk', 'policy', 'audit']));
      return;
    }

    // Handle platform/modules/status - GET
    if (url.includes('/platform/modules/status') && method === 'GET') {
      logMock(method, url, true);
      await route.fulfill(successResponse({}));
      return;
    }

    // Handle platform/modules/menu - GET
    if (url.includes('/platform/modules/menu') && method === 'GET') {
      logMock(method, url, true);
      await route.fulfill(successResponse([]));
      return;
    }

    // Handle admin/notifications/status - GET (System Status page)
    if (url.includes('/admin/notifications/status') && method === 'GET') {
      logMock(method, url, true);
      await route.fulfill(successResponse({
        email: { enabled: false, configured: false },
        webhook: { enabled: false, configured: false },
        recentLogs: { total: 0, success: 0, failed: 0, lastAttempt: null },
      }));
      return;
    }

    // Handle admin/jobs/status - GET (System Status page)
    if (url.includes('/admin/jobs/status') && method === 'GET') {
      logMock(method, url, true);
      await route.fulfill(successResponse({
        registeredJobs: [],
        totalJobs: 0,
        enabledJobs: 0,
        recentRuns: [],
      }));
      return;
    }

    // Handle admin/jobs/platform-validation - GET (System Status page)
    if (url.includes('/admin/jobs/platform-validation') && method === 'GET') {
      logMock(method, url, true);
      await route.fulfill(successResponse({
        hasResult: false,
        result: null,
      }));
      return;
    }

    // Handle grc/insights/overview - GET (GRC Insights page)
    if (url.includes('/grc/insights/overview') && method === 'GET') {
      logMock(method, url, true);
      await route.fulfill(successResponse({
        openIssuesBySeverity: { CRITICAL: 0, HIGH: 1, MEDIUM: 0, LOW: 0 },
        overdueCAPAsCount: 0,
        recentFailTestResults: [{
          id: 'mock-test-result-001',
          name: 'Mock Security Control Test - FAIL',
          testedAt: '2024-01-20T00:00:00Z',
          controlTestName: 'Security Control Test',
        }],
        evidenceStats: { linked: 1, unlinked: 0, total: 1 },
        summary: { totalOpenIssues: 1, totalOverdueCAPAs: 0, totalFailedTests: 1 },
      }));
      return;
    }

    // Handle grc/status-history/by-entity - GET (History tabs in detail pages)
    if (url.includes('/grc/status-history/by-entity') && method === 'GET') {
      logMock(method, url, true);
      await route.fulfill(successResponse([
        {
          id: 'sh-001',
          entityType: 'EVIDENCE',
          entityId: 'mock-entity-001',
          previousStatus: null,
          newStatus: 'ACTIVE',
          changedAt: '2024-01-15T00:00:00Z',
          changedBy: 'admin@test.com',
          reason: 'Initial creation',
        },
      ]));
      return;
    }

    // Handle grc/evidence - GET (Evidence list and detail pages)
    if (url.includes('/grc/evidence') && method === 'GET') {
      logMock(method, url, true);
      const mockEvidence = {
        id: 'mock-evidence-001',
        tenantId: 'test-tenant-id',
        name: 'Mock Security Audit Evidence',
        description: 'Evidence for E2E testing',
        type: 'BASELINE',
        status: 'ACTIVE',
        collectionDate: '2024-01-15',
        expirationDate: '2025-01-15',
        sourceSystem: 'Manual',
        controlIds: ['mock-control-1'],
        createdAt: '2024-01-15T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
      };
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

    // Handle grc/test-results - GET (Test Results list and detail pages)
    if (url.includes('/grc/test-results') && method === 'GET') {
      logMock(method, url, true);
      const mockTestResult = {
        id: 'mock-test-result-001',
        tenantId: 'test-tenant-id',
        name: 'Mock Security Control Test - FAIL',
        result: 'FAIL',
        testedAt: '2024-01-20T00:00:00Z',
        notes: 'Control failed due to missing documentation',
        controlTestId: 'mock-control-test-001',
        controlTest: {
          id: 'mock-control-test-001',
          name: 'Security Control Test',
          controlId: 'mock-control-1',
        },
        evidenceIds: ['mock-evidence-001'],
        createdAt: '2024-01-20T00:00:00Z',
        updatedAt: '2024-01-20T00:00:00Z',
      };
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

    // Handle grc/issues - GET (Issues list and detail pages)
    if (url.includes('/grc/issues') && method === 'GET') {
      logMock(method, url, true);
      const mockIssue = {
        id: 'mock-issue-001',
        tenantId: 'test-tenant-id',
        title: 'Mock Security Control Failure Issue',
        description: 'Issue created from failed test result',
        type: 'internal_audit',
        severity: 'HIGH',
        status: 'OPEN',
        dueDate: '2024-02-28',
        testResultId: 'mock-test-result-001',
        evidenceId: 'mock-evidence-001',
        createdAt: '2024-01-21T00:00:00Z',
        updatedAt: '2024-01-21T00:00:00Z',
      };
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

    // Handle grc/capas/by-issue/:issueId - GET (linked CAPAs for an issue)
    if (url.includes('/grc/capas/by-issue/') && method === 'GET') {
      logMock(method, url, true);
      const mockLinkedCapa = {
        id: 'mock-capa-001',
        tenantId: 'test-tenant-id',
        title: 'Mock Corrective Action Plan',
        description: 'CAPA to address security control failure',
        type: 'corrective',
        status: 'planned',
        priority: 'high',
        dueDate: '2024-02-15',
        issueId: 'mock-issue-001',
        issue: {
          id: 'mock-issue-001',
          title: 'Mock Security Control Failure Issue',
          status: 'OPEN',
          severity: 'HIGH',
        },
        createdAt: '2024-01-22T00:00:00Z',
        updatedAt: '2024-01-22T00:00:00Z',
      };
      // Return array of linked CAPAs (can be empty or with mock data)
      await route.fulfill(successResponse([mockLinkedCapa]));
      return;
    }

    // Handle grc/capas - GET (CAPA list and detail pages) - note: API uses plural 'capas'
    if (url.includes('/grc/capas') && method === 'GET') {
      logMock(method, url, true);
      const mockCapa = {
        id: 'mock-capa-001',
        tenantId: 'test-tenant-id',
        title: 'Mock Corrective Action Plan',
        description: 'CAPA to address security control failure',
        type: 'corrective',
        status: 'planned',
        priority: 'high',
        dueDate: '2024-02-15',
        issueId: 'mock-issue-001',
        issue: {
          id: 'mock-issue-001',
          title: 'Mock Security Control Failure Issue',
          status: 'OPEN',
          severity: 'HIGH',
        },
        createdAt: '2024-01-22T00:00:00Z',
        updatedAt: '2024-01-22T00:00:00Z',
      };
      if (url.match(/\/grc\/capas\/[^/?]+$/)) {
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

    // Handle grc/bcm/services - GET (BCM Services list and detail pages)
    if (url.includes('/grc/bcm/services') && method === 'GET') {
      logMock(method, url, true);
      const mockBcmService = {
        id: 'mock-bcm-service-001',
        tenantId: 'test-tenant-id',
        name: 'Mock Critical Business Service',
        description: 'A critical business service for E2E testing',
        criticality: 'HIGH',
        rtoHours: 4,
        rpoHours: 1,
        mtpdHours: 24,
        tier: 1,
        status: 'ACTIVE',
        createdAt: '2024-01-15T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
      };
      if (url.match(/\/grc\/bcm\/services\/[^/?]+$/)) {
        await route.fulfill(successResponse(mockBcmService));
      } else {
        await route.fulfill(successResponse({
          items: [mockBcmService],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        }));
      }
      return;
    }

    // Handle grc/bcm/exercises - GET (BCM Exercises list and detail pages)
    if (url.includes('/grc/bcm/exercises') && method === 'GET') {
      logMock(method, url, true);
      const mockBcmExercise = {
        id: 'mock-bcm-exercise-001',
        tenantId: 'test-tenant-id',
        name: 'Mock Tabletop Exercise',
        description: 'A tabletop exercise for E2E testing',
        exerciseType: 'TABLETOP',
        status: 'PLANNED',
        scheduledDate: '2024-03-15T10:00:00Z',
        createdAt: '2024-01-15T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
      };
      if (url.match(/\/grc\/bcm\/exercises\/[^/?]+$/)) {
        await route.fulfill(successResponse(mockBcmExercise));
      } else {
        await route.fulfill(successResponse({
          items: [mockBcmExercise],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        }));
      }
      return;
    }

    // Handle grc/calendar/events - GET (GRC Calendar events)
    // CalendarEventData interface expects: id, sourceType, sourceId, title, startAt, endAt, status, severity, priority, ownerUserId, url, metadata
    if (url.includes('/grc/calendar/events') && method === 'GET') {
      logMock(method, url, true);
      const mockCalendarEvents = [
        {
          id: 'cal-event-001',
          sourceType: 'BCM_EXERCISE',
          sourceId: 'mock-bcm-exercise-001',
          title: 'Mock BCM Exercise',
          startAt: '2024-03-15T10:00:00Z',
          endAt: '2024-03-15T12:00:00Z',
          status: 'PLANNED',
          severity: null,
          priority: null,
          ownerUserId: null,
          url: '/bcm/exercises/mock-bcm-exercise-001',
          metadata: null,
        },
        {
          id: 'cal-event-002',
          sourceType: 'CAPA',
          sourceId: 'mock-capa-001',
          title: 'Mock CAPA Due',
          startAt: '2024-02-15T00:00:00Z',
          endAt: '2024-02-15T23:59:59Z',
          status: 'open',
          severity: null,
          priority: null,
          ownerUserId: null,
          url: '/findings/capas/mock-capa-001',
          metadata: null,
        },
      ];
      await route.fulfill(successResponse(mockCalendarEvents));
      return;
    }

    // Handle grc/standards - GET (Standards library list and detail pages)
    if (url.includes('/grc/standards') && method === 'GET') {
      logMock(method, url, true);
      const mockStandards = [
        {
          id: 'mock-standard-iso27001',
          tenantId: 'test-tenant-id',
          code: 'ISO27001',
          name: 'ISO/IEC 27001:2022',
          version: '2022',
          domain: 'security',
          description: 'Information security management systems',
          publisher: 'ISO/IEC',
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'mock-standard-iso20000',
          tenantId: 'test-tenant-id',
          code: 'ISO20000',
          name: 'ISO/IEC 20000-1:2018',
          version: '2018',
          domain: 'compliance',
          description: 'IT Service Management System Requirements',
          publisher: 'ISO/IEC',
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];
      if (url.match(/\/grc\/standards\/[^/?]+$/)) {
        await route.fulfill(successResponse(mockStandards[0]));
      } else if (url.match(/\/grc\/standards\/[^/?]+\/clauses/)) {
        // Standards clauses endpoint
        await route.fulfill(successResponse({
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 0,
        }));
      } else {
        await route.fulfill(successResponse({
          items: mockStandards,
          total: mockStandards.length,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        }));
      }
      return;
    }

    // Generic fallback for other API endpoints
    if (method === 'GET') {
      logMock(method, url, true);
      await route.fulfill(successResponse([]));
    } else {
      logMock(method, url, true);
      await route.fulfill(successResponse(null));
    }
  });
}

/**
 * Ensure the sidebar/navigation drawer is open and visible
 * This is important for E2E tests where the drawer might be collapsed on smaller viewports
 */
export async function ensureSidebarOpen(page: Page) {
  // Check if hamburger menu button exists (mobile view)
  const menuButton = page.getByTestId('btn-toggle-sidebar');
  const menuButtonCount = await menuButton.count();
  
  if (menuButtonCount > 0) {
    // Check if button is visible (drawer is closed)
    const isVisible = await menuButton.isVisible().catch(() => false);
    if (isVisible) {
      await menuButton.click();
      // Wait for drawer animation to complete using proper selector instead of timeout
      // The drawer should become visible with nav items
      await page.locator('[data-testid="nav-dashboard"], [data-testid="nav-admin"]').first()
        .waitFor({ state: 'visible', timeout: 2000 })
        .catch(() => {
          // Drawer may already be open or animation may be instant
        });
    }
  }
  
  // Verify at least one nav item is visible (desktop view or after opening mobile drawer)
  // This ensures the sidebar is actually open
  const navItems = [
    page.getByTestId('nav-dashboard'),
    page.getByTestId('nav-admin'),
    page.getByTestId('nav-audit'),
  ];
  
  // Wait for at least one nav item to be visible
  await Promise.race(
    navItems.map(item => 
      expect(item).toBeVisible({ timeout: 2000 }).catch(() => {})
    )
  );
}

/**
 * Login helper function
 */
export async function login(page: Page) {
  // Setup mock API if enabled (MUST be called before any navigation)
  await setupMockApi(page);
  
  await page.goto('/login');
  
  // Increase timeout for CI environments
  const loginTimeout = process.env.CI ? 15000 : 5000;
  await expect(page.getByTestId('page-login-title')).toBeVisible({ timeout: loginTimeout });
  
  await page.getByTestId('input-username').fill(TEST_CREDENTIALS.email);
  await page.getByTestId('input-password').fill(TEST_CREDENTIALS.password);
  await page.getByTestId('button-login').click();
  
  // Wait for navigation to dashboard after login
  await page.waitForURL(/\/(dashboard|admin)/);
  
  // Ensure sidebar is open so navigation items are accessible
  await ensureSidebarOpen(page);
}

/**
 * Wait for API response helper
 */
export async function waitForApiResponse(page: Page, urlPattern: string | RegExp, timeout = 10000) {
  return page.waitForResponse(
    (response) => {
      const url = response.url();
      return typeof urlPattern === 'string' ? url.includes(urlPattern) : urlPattern.test(url);
    },
    { timeout }
  );
}

/**
 * Wait for list page to be loaded and verify exactly one of list-table or list-empty is visible.
 * This helper avoids Playwright strict mode violations by ensuring only one element exists.
 * 
 * The GenericListPage and UniversalListPage components now conditionally render:
 * - data-testid="list-table" when items.length > 0
 * - data-testid="list-empty" when items.length === 0
 * 
 * @param page - Playwright page object
 * @param timeout - Maximum time to wait for the list to load (default: 15000ms)
 * @returns 'table' if list-table is visible, 'empty' if list-empty is visible
 */
export async function expectListLoaded(page: Page, timeout = 15000): Promise<'table' | 'empty'> {
  const listTable = page.locator('[data-testid="list-table"]');
  const listEmpty = page.locator('[data-testid="list-empty"]');

  await expect.poll(
    async () => {
      const tableCount = await listTable.count();
      const emptyCount = await listEmpty.count();
      return tableCount + emptyCount;
    },
    { timeout, message: 'Expected exactly one of list-table or list-empty to be present' }
  ).toBe(1);

  const tableVisible = await listTable.count() > 0;
  if (tableVisible) {
    await expect(listTable).toBeVisible({ timeout: 5000 });
    return 'table';
  } else {
    await expect(listEmpty).toBeVisible({ timeout: 5000 });
    return 'empty';
  }
}

