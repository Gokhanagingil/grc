/**
 * Webhook Integration E2E Tests
 *
 * Tests webhook delivery golden paths:
 * 1. Webhook endpoint admin CRUD works via /api/grc/webhook-endpoints
 * 2. Auth header present on webhook management calls
 * 3. Webhook test delivery endpoint returns signature header
 */

import { test, expect } from '@playwright/test';
import { login, setupMockApi } from './helpers';

const isMockMode = process.env.E2E_MOCK_API === '1';

test.describe('Webhook Integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  test.describe('Webhook endpoint API prefix', () => {
    test.skip(!isMockMode, 'Mock mode only');

    test('Webhook endpoints list calls /api/grc/webhook-endpoints', async ({ page }) => {
      const webhookRequests: string[] = [];

      await page.route('**/grc/webhook-endpoints**', async (route) => {
        webhookRequests.push(route.request().url());
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
          }),
        });
      });

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

      await login(page);
      await page.goto('/admin/notification-studio');

      const webhooksTab = page.locator('button', { hasText: /Webhooks/i });
      if (await webhooksTab.isVisible()) {
        await webhooksTab.click();
      }

      await expect.poll(() => webhookRequests.length, {
        timeout: 15000,
        message: 'Expected at least one request to /grc/webhook-endpoints',
      }).toBeGreaterThanOrEqual(1);

      for (const url of webhookRequests) {
        expect(url).toContain('/api/grc/webhook-endpoints');
      }
    });
  });

  test.describe('Webhook auth header', () => {
    test.skip(!isMockMode, 'Mock mode only');

    test('Webhook endpoint requests include Authorization Bearer token', async ({ page }) => {
      const capturedHeaders: (string | null)[] = [];

      await page.route('**/grc/webhook-endpoints**', async (route) => {
        capturedHeaders.push(route.request().headers()['authorization'] ?? null);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
          }),
        });
      });

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

      await login(page);
      await page.goto('/admin/notification-studio');

      const webhooksTab = page.locator('button', { hasText: /Webhooks/i });
      if (await webhooksTab.isVisible()) {
        await webhooksTab.click();
      }

      await expect.poll(() => capturedHeaders.length, {
        timeout: 15000,
        message: 'Expected at least one webhook request',
      }).toBeGreaterThanOrEqual(1);

      expect(capturedHeaders[0]).toBeTruthy();
      expect(capturedHeaders[0]).toMatch(/^Bearer .+/);
    });
  });

  test.describe('Webhook test delivery (real backend)', () => {
    test.skip(isMockMode, 'Requires real backend');

    test('Webhook test endpoint requires authentication', async ({ request }) => {
      const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';

      const response = await request.post(`${baseUrl}/api/grc/webhook-endpoints/test`, {
        headers: { 'Content-Type': 'application/json' },
        data: { url: 'https://example.com/test' },
      });

      expect([401, 403]).toContain(response.status());
    });
  });
});
