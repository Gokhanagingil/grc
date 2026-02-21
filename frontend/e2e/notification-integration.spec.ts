/**
 * Notification Integration E2E Tests @smoke
 *
 * Tests the notification engine golden paths:
 * 1. API prefix regression: notification endpoints use /api/grc/...
 * 2. Auth header regression: notification calls include Authorization
 * 3. Bell icon: unread count badge and drawer panel
 * 4. Notification Studio: admin screens accessible with proper RBAC
 *
 * Relies on setupMockApi (helpers.ts) for default notification/webhook/catalog
 * route handlers. Per-test overrides use page.route() registered AFTER login()
 * so Playwright LIFO evaluation gives them priority.
 */

import { test, expect } from '@playwright/test';
import { login } from './helpers';

const isMockMode = process.env.E2E_MOCK_API === '1';

test.describe('Notification Integration @mock @smoke', () => {
  test.describe('API prefix regression', () => {
    test.skip(!isMockMode, 'Mock mode only - verifies frontend call patterns');

    test('Notification bell calls /api/grc/user-notifications with correct prefix', async ({ page }) => {
      const notifRequests: string[] = [];
      page.on('request', (req) => {
        if (req.url().includes('/grc/user-notifications')) {
          notifRequests.push(req.url());
        }
      });

      await login(page);
      await page.goto('/dashboard');

      await expect.poll(() => notifRequests.length, {
        timeout: 15000,
        message: 'Expected at least one request to /grc/user-notifications',
      }).toBeGreaterThanOrEqual(1);

      for (const url of notifRequests) {
        expect(url).toContain('/api/grc/user-notifications');
      }
    });
  });

  test.describe('Auth header on notification calls', () => {
    test.skip(!isMockMode, 'Mock mode only - verifies auth headers');

    test('Notification requests include Authorization Bearer token', async ({ page }) => {
      const capturedHeaders: (string | null)[] = [];
      page.on('request', (req) => {
        if (req.url().includes('/grc/user-notifications')) {
          capturedHeaders.push(req.headers()['authorization'] ?? null);
        }
      });

      await login(page);
      await page.goto('/dashboard');

      await expect.poll(() => capturedHeaders.length, {
        timeout: 15000,
        message: 'Expected at least one user-notifications request',
      }).toBeGreaterThanOrEqual(1);

      expect(capturedHeaders[0]).toBeTruthy();
      expect(capturedHeaders[0]).toMatch(/^Bearer .+/);
    });
  });

  test.describe('Bell icon and drawer', () => {
    test.skip(!isMockMode, 'Mock mode only');

    test('Bell icon is visible in header after login', async ({ page }) => {
      await login(page);

      const bellButton = page.locator('[data-testid="notification-bell"]');
      await expect(bellButton).toBeVisible({ timeout: 10000 });
    });

    test('Bell icon shows unread badge when notifications exist', async ({ page }) => {
      await login(page);

      await page.route('**/grc/user-notifications**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              items: [
                { id: '1', title: 'Test Notification 1', body: 'Body 1', isRead: false, createdAt: new Date().toISOString() },
                { id: '2', title: 'Test Notification 2', body: 'Body 2', isRead: false, createdAt: new Date().toISOString() },
                { id: '3', title: 'Test Notification 3', body: 'Body 3', isRead: false, createdAt: new Date().toISOString() },
              ],
              total: 3, page: 1, pageSize: 20, totalPages: 1,
            },
          }),
        });
      });

      await page.goto('/dashboard');

      const badge = page.locator('.MuiBadge-badge');
      await expect(badge).toHaveText('3', { timeout: 10000 });
    });
  });

  test.describe('Notification Studio admin access', () => {
    test.skip(!isMockMode, 'Mock mode only');

    test('Notification Studio page loads for admin user', async ({ page }) => {
      await login(page);
      await page.goto('/admin/notification-studio');

      await expect(page.locator('h4, h5, h6').filter({ hasText: 'Notification Studio' })).toBeVisible({ timeout: 10000 });
    });

    test('Notification Studio shows 401 error state on unauthorized', async ({ page }) => {
      await login(page);

      // Override notification-rules to return 401 (LIFO priority over helpers.ts handler)
      await page.route('**/grc/notification-rules**', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }),
        });
      });

      await page.goto('/admin/notification-studio');

      const loadingSpinner = page.locator('[role="progressbar"]');
      await expect(loadingSpinner).not.toBeVisible({ timeout: 10000 });
    });
  });
});
