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

  const mockTenantContext = {
    tenantId: 'test-tenant-id',
    permissions: ['admin', 'manage_users', 'view_audits'],
  };

  // Helper to return success response with data envelope
  const successResponse = (data: unknown) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data }),
  });

  // Mock auth/login - POST
  // CRITICAL: Only intercept xhr/fetch requests, never HTML/CSS/JS/images
  await page.route('**/auth/login', async (route) => {
    const resourceType = route.request().resourceType();
    if (resourceType !== 'xhr' && resourceType !== 'fetch') {
      await route.continue();
      return;
    }
    if (route.request().method() === 'POST') {
      await route.fulfill(successResponse({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: mockAdminUser,
      }));
    } else {
      await route.continue();
    }
  });

  // Mock auth/me - GET (for user info)
  await page.route('**/auth/me', async (route) => {
    const resourceType = route.request().resourceType();
    if (resourceType !== 'xhr' && resourceType !== 'fetch') {
      await route.continue();
      return;
    }
    await route.fulfill(successResponse(mockAdminUser));
  });

  // Mock users/me - GET (for user info)
  await page.route('**/users/me', async (route) => {
    const resourceType = route.request().resourceType();
    if (resourceType !== 'xhr' && resourceType !== 'fetch') {
      await route.continue();
      return;
    }
    await route.fulfill(successResponse(mockAdminUser));
  });

  // Mock onboarding/context - GET
  await page.route('**/onboarding/context', async (route) => {
    const resourceType = route.request().resourceType();
    if (resourceType !== 'xhr' && resourceType !== 'fetch') {
      await route.continue();
      return;
    }
    await route.fulfill(successResponse(mockTenantContext));
  });

  // Mock audit-logs - GET
  await page.route('**/audit-logs**', async (route) => {
    const resourceType = route.request().resourceType();
    if (resourceType !== 'xhr' && resourceType !== 'fetch') {
      await route.continue();
      return;
    }
    if (route.request().method() === 'GET') {
      await route.fulfill(successResponse([]));
    } else {
      await route.continue();
    }
  });

  // Mock grc/audits - GET (list, can/create, distinct/department)
  await page.route('**/grc/audits**', async (route) => {
    const resourceType = route.request().resourceType();
    if (resourceType !== 'xhr' && resourceType !== 'fetch') {
      await route.continue();
      return;
    }
    if (route.request().method() === 'GET') {
      const url = route.request().url();
      if (url.includes('/can/create')) {
        await route.fulfill(successResponse({ allowed: true }));
      } else if (url.includes('/distinct/department')) {
        await route.fulfill(successResponse([]));
      } else {
        // List endpoint
        await route.fulfill(successResponse({
          audits: [],
          pagination: { total: 0, page: 1, pageSize: 10, totalPages: 0 },
        }));
      }
    } else {
      await route.continue();
    }
  });

  // Mock tenants - GET
  await page.route('**/tenants**', async (route) => {
    const resourceType = route.request().resourceType();
    if (resourceType !== 'xhr' && resourceType !== 'fetch') {
      await route.continue();
      return;
    }
    if (route.request().method() === 'GET') {
      await route.fulfill(successResponse([]));
    } else {
      await route.continue();
    }
  });

  // Mock users/statistics/overview - GET
  await page.route('**/users/statistics/overview', async (route) => {
    const resourceType = route.request().resourceType();
    if (resourceType !== 'xhr' && resourceType !== 'fetch') {
      await route.continue();
      return;
    }
    await route.fulfill(successResponse({
      total: 0,
      active: 0,
      inactive: 0,
    }));
  });

  // Mock health/detailed - GET
  await page.route('**/health/detailed', async (route) => {
    const resourceType = route.request().resourceType();
    if (resourceType !== 'xhr' && resourceType !== 'fetch') {
      await route.continue();
      return;
    }
    await route.fulfill(successResponse({
      status: 'ok',
      uptime: 1000,
      timestamp: new Date().toISOString(),
    }));
  });

  // Mock settings/system - GET
  await page.route('**/settings/system', async (route) => {
    const resourceType = route.request().resourceType();
    if (resourceType !== 'xhr' && resourceType !== 'fetch') {
      await route.continue();
      return;
    }
    await route.fulfill(successResponse({
      settings: [],
    }));
  });

  // Mock any other API endpoints with generic empty response
  // Scoped to /api/, /auth/, /onboarding/, /admin/, /grc/, /audit/ patterns
  // CRITICAL: Only intercepts xhr/fetch, never static assets
  await page.route(/\/(api|auth|onboarding|admin|grc|audit|users|tenants|health|settings)\//, async (route) => {
    // CRITICAL: Only intercept API requests (xhr/fetch), never static assets
    const resourceType = route.request().resourceType();
    if (resourceType !== 'xhr' && resourceType !== 'fetch') {
      await route.continue();
      return;
    }

    const url = route.request().url();
    // Only intercept if it's not already handled above
    const handledPatterns = [
      '/auth/login',
      '/auth/me',
      '/users/me',
      '/onboarding/context',
      '/audit-logs',
      '/grc/audits',
      '/tenants',
      '/users/statistics/overview',
      '/health/detailed',
      '/settings/system',
    ];
    
    const isHandled = handledPatterns.some(pattern => url.includes(pattern));
    if (!isHandled && route.request().method() === 'GET') {
      // Return empty array for list endpoints
      await route.fulfill(successResponse([]));
    } else if (!isHandled) {
      // For POST/PUT/PATCH/DELETE, return success with null data
      await route.fulfill(successResponse(null));
    } else {
      await route.continue();
    }
  });
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
  await page.getByTestId('btn-submit-login').click();
  
  // Wait for navigation to dashboard after login
  await page.waitForURL(/\/(dashboard|admin)/);
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

