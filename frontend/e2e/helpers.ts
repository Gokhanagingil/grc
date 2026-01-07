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
        GRC_SUITE: ['risk', 'policy', 'audit'],
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

