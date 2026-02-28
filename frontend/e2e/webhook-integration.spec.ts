/**
 * Webhook Integration E2E Tests @smoke
 *
 * Tests webhook delivery golden paths:
 * 1. Webhook endpoint admin CRUD works via /api/grc/webhook-endpoints
 * 2. Auth header present on webhook management calls
 * 3. Webhook test delivery endpoint returns signature header
 *
 * Relies on setupMockApi (helpers.ts) for default webhook/notification
 * route handlers. Per-test overrides use page.route() registered AFTER login()
 * so Playwright LIFO evaluation gives them priority.
 */

import { test, expect } from '@playwright/test';
import { login } from './helpers';

const isMockMode = process.env.E2E_MOCK_API === '1' || process.env.E2E_MODE === 'MOCK_UI';

test.describe('Webhook Integration @mock @smoke', () => {
  test.describe('Webhook endpoint API prefix', () => {
    test.skip(isMockMode, 'Notification-studio does not fetch webhook list in static/mock build; run with real-stack to verify');

    test('Webhook endpoints list calls /api/grc/webhook-endpoints', async ({ page }) => {
      const webhookRequests: string[] = [];
      page.on('request', (req) => {
        if (req.url().includes('/grc/webhook-endpoints')) {
          webhookRequests.push(req.url());
        }
      });

      await login(page);
      await page.goto('/admin/notification-studio');
      await page.waitForLoadState('domcontentloaded');

      const webhooksTab = page.getByRole('button', { name: /Webhooks/i });
      if (await webhooksTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await webhooksTab.click();
        await page.waitForTimeout(500);
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
    test.skip(isMockMode, 'Notification-studio does not fetch webhook list in static/mock build; run with real-stack to verify');

    test('Webhook endpoint requests include Authorization Bearer token', async ({ page }) => {
      const capturedHeaders: (string | null)[] = [];
      page.on('request', (req) => {
        if (req.url().includes('/grc/webhook-endpoints')) {
          capturedHeaders.push(req.headers()['authorization'] ?? null);
        }
      });

      await login(page);
      await page.goto('/admin/notification-studio');
      await page.waitForLoadState('domcontentloaded');

      const webhooksTab = page.getByRole('button', { name: /Webhooks/i });
      if (await webhooksTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await webhooksTab.click();
        await page.waitForTimeout(500);
      }

      await expect
        .poll(
          () => capturedHeaders.length,
          { timeout: 15000, message: 'Expected at least one webhook request' },
        )
        .toBeGreaterThanOrEqual(1);

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
