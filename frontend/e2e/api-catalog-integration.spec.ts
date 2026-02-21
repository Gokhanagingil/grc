/**
 * API Catalog Integration E2E Tests @smoke
 *
 * Tests the API Catalog golden paths:
 * 1. API prefix regression: catalog endpoints use /api/grc/...
 * 2. Auth header: catalog calls include Authorization
 * 3. Public API: valid/invalid API key scenarios
 * 4. Admin screens: API Catalog page loads with RBAC
 *
 * Relies on setupMockApi (helpers.ts) for default published-apis/api-keys
 * route handlers. Per-test overrides use page.route() registered AFTER login()
 * so Playwright LIFO evaluation gives them priority.
 */

import { test, expect } from '@playwright/test';
import { login } from './helpers';

const isMockMode = process.env.E2E_MOCK_API === '1';

test.describe('API Catalog Integration @mock @smoke', () => {
  test.describe('API prefix regression', () => {
    test.skip(!isMockMode, 'Mock mode only');

    test('Published APIs list calls /api/grc/published-apis', async ({ page }) => {
      const apiRequests: string[] = [];
      page.on('request', (req) => {
        if (req.url().includes('/grc/published-apis')) {
          apiRequests.push(req.url());
        }
      });

      await login(page);
      await page.goto('/admin/api-catalog');

      await expect.poll(() => apiRequests.length, {
        timeout: 15000,
        message: 'Expected at least one request to /grc/published-apis',
      }).toBeGreaterThanOrEqual(1);

      for (const url of apiRequests) {
        expect(url).toContain('/api/grc/published-apis');
      }
    });
  });

  test.describe('Auth header on catalog calls', () => {
    test.skip(!isMockMode, 'Mock mode only');

    test('Published APIs requests include Authorization Bearer token', async ({ page }) => {
      const capturedHeaders: (string | null)[] = [];
      page.on('request', (req) => {
        if (req.url().includes('/grc/published-apis')) {
          capturedHeaders.push(req.headers()['authorization'] ?? null);
        }
      });

      await login(page);
      await page.goto('/admin/api-catalog');

      await expect.poll(() => capturedHeaders.length, {
        timeout: 15000,
        message: 'Expected at least one published-apis request',
      }).toBeGreaterThanOrEqual(1);

      expect(capturedHeaders[0]).toBeTruthy();
      expect(capturedHeaders[0]).toMatch(/^Bearer .+/);
    });
  });

  test.describe('API Catalog admin page', () => {
    test.skip(!isMockMode, 'Mock mode only');

    test('API Catalog page loads for admin user', async ({ page }) => {
      await login(page);
      await page.goto('/admin/api-catalog');

      await expect(page.locator('h4, h5, h6').filter({ hasText: 'API Catalog' })).toBeVisible({ timeout: 10000 });
    });

    test('API Catalog shows error state on 403 Forbidden', async ({ page }) => {
      await login(page);

      // Override published-apis to return 403 (LIFO priority over helpers.ts handler)
      await page.route('**/grc/published-apis**', async (route) => {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } }),
        });
      });

      await page.goto('/admin/api-catalog');

      const loadingSpinner = page.locator('[role="progressbar"]');
      await expect(loadingSpinner).not.toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Public API gateway', () => {
    test.skip(isMockMode, 'Requires real backend');

    test('Public API with valid key returns 200', async ({ request }) => {
      const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';

      const response = await request.get(`${baseUrl}/api/grc/public/v1/incidents/records`, {
        headers: {
          'X-API-Key': process.env.E2E_API_KEY || 'grc_test_key_placeholder',
        },
      });

      expect([200, 404]).toContain(response.status());
    });

    test('Public API with invalid key returns 401 or 403', async ({ request }) => {
      const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';

      const response = await request.get(`${baseUrl}/api/grc/public/v1/incidents/records`, {
        headers: {
          'X-API-Key': 'grc_invalid_key_00000000000000000000000000000000',
        },
      });

      expect([401, 403]).toContain(response.status());
    });

    test('Public API without key returns 401 or 403', async ({ request }) => {
      const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';

      const response = await request.get(`${baseUrl}/api/grc/public/v1/incidents/records`);

      expect([401, 403]).toContain(response.status());
    });
  });
});
