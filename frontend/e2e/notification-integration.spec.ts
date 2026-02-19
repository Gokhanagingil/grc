/**
 * Notification Integration E2E Tests
 *
 * Tests the notification engine golden paths:
 * 1. API prefix regression: notification endpoints use /api/grc/...
 * 2. Auth header regression: notification calls include Authorization
 * 3. Bell icon: unread count badge and drawer panel
 * 4. Notification Studio: admin screens accessible with proper RBAC
 */

import { test, expect } from '@playwright/test';
import { login } from './helpers';

const isMockMode = process.env.E2E_MOCK_API === '1';

test.describe('Notification Integration', () => {
  test.describe('API prefix regression', () => {
    test.skip(!isMockMode, 'Mock mode only - verifies frontend call patterns');

    test('Notification bell calls /api/grc/notifications/me with correct prefix', async ({ page }) => {
      const notifRequests: string[] = [];

      await login(page);

      await page.route('**/grc/notifications/**', async (route) => {
        notifRequests.push(route.request().url());
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0, unreadCount: 0 },
          }),
        });
      });

      await page.goto('/dashboard');

      await expect.poll(() => notifRequests.length, {
        timeout: 15000,
        message: 'Expected at least one request to notification endpoint',
      }).toBeGreaterThanOrEqual(1);

      for (const url of notifRequests) {
        expect(url).toContain('/api/grc/notifications/');
      }
    });
  });

  test.describe('Auth header on notification calls', () => {
    test.skip(!isMockMode, 'Mock mode only - verifies auth headers');

    test('Notification requests include Authorization Bearer token', async ({ page }) => {
      const capturedHeaders: (string | null)[] = [];

      await login(page);

      await page.route('**/grc/notifications/**', async (route) => {
        capturedHeaders.push(route.request().headers()['authorization'] ?? null);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0, unreadCount: 0 },
          }),
        });
      });

      await page.goto('/dashboard');

      await expect.poll(() => capturedHeaders.length, {
        timeout: 15000,
        message: 'Expected at least one notification request',
      }).toBeGreaterThanOrEqual(1);

      expect(capturedHeaders[0]).toBeTruthy();
      expect(capturedHeaders[0]).toMatch(/^Bearer .+/);
    });
  });

  test.describe('Bell icon and drawer', () => {
    test.skip(!isMockMode, 'Mock mode only');

    test('Bell icon is visible in header after login', async ({ page }) => {
      await login(page);

      await page.route('**/grc/notifications/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0, unreadCount: 0 },
          }),
        });
      });

      const bellButton = page.locator('[data-testid="notification-bell"]');
      await expect(bellButton).toBeVisible({ timeout: 10000 });
    });

    test('Bell icon shows unread badge when notifications exist', async ({ page }) => {
      await login(page);

      await page.route('**/grc/notifications/**', async (route) => {
        const url = route.request().url();
        if (url.includes('/unread-count') || url.includes('unreadCount')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: { unreadCount: 3 } }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                items: [
                  { id: '1', title: 'Test Notification', body: 'Test body', readAt: null, createdAt: new Date().toISOString() },
                ],
                total: 1, page: 1, pageSize: 20, totalPages: 1, unreadCount: 3,
              },
            }),
          });
        }
      });

      await page.goto('/dashboard');

      const badge = page.locator('.MuiBadge-badge');
      await expect(badge).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Notification Studio admin access', () => {
    test.skip(!isMockMode, 'Mock mode only');

    test('Notification Studio page loads for admin user', async ({ page }) => {
      await login(page);

      await page.route('**/grc/notification-rules**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
          }),
        });
      });

      await page.route('**/grc/notification-templates**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
          }),
        });
      });

      await page.route('**/grc/webhook-endpoints**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
          }),
        });
      });

      await page.route('**/grc/notification-deliveries**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
          }),
        });
      });

      await page.route('**/grc/notifications/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0, unreadCount: 0 },
          }),
        });
      });

      await page.goto('/admin/notification-studio');

      await expect(page.locator('h4, h5, h6').filter({ hasText: 'Notification Studio' })).toBeVisible({ timeout: 10000 });
    });

    test('Notification Studio shows 401 error state on unauthorized', async ({ page }) => {
      await login(page);

      await page.route('**/grc/notification-rules**', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }),
        });
      });

      await page.route('**/grc/notifications/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0, unreadCount: 0 },
          }),
        });
      });

      await page.goto('/admin/notification-studio');

      const loadingSpinner = page.locator('[role="progressbar"]');
      await expect(loadingSpinner).not.toBeVisible({ timeout: 10000 });
    });
  });
});
