import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('ITSM Auth Header Regression @mock', () => {
  test('ITSM Changes request includes Authorization header', async ({ page }) => {
    const itsmRequests: { url: string; authorization: string | null }[] = [];

    await login(page);

    await page.route('**/grc/itsm/changes*', async (route) => {
      const request = route.request();
      itsmRequests.push({
        url: request.url(),
        authorization: request.headers()['authorization'] ?? null,
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
        }),
      });
    });

    await page.goto('/itsm/changes');

    await expect.poll(() => itsmRequests.length, {
      timeout: 15000,
      message: 'Expected at least one request to /grc/itsm/changes',
    }).toBeGreaterThanOrEqual(1);

    const req = itsmRequests[0];
    expect(req.authorization).toBeTruthy();
    expect(req.authorization).toMatch(/^Bearer .+/);
  });

  test('ITSM Incidents request includes Authorization header', async ({ page }) => {
    const itsmRequests: { url: string; authorization: string | null }[] = [];

    await login(page);

    await page.route('**/grc/itsm/incidents*', async (route) => {
      const request = route.request();
      itsmRequests.push({
        url: request.url(),
        authorization: request.headers()['authorization'] ?? null,
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { data: [], items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
        }),
      });
    });

    await page.goto('/itsm/incidents');

    await expect.poll(() => itsmRequests.length, {
      timeout: 15000,
      message: 'Expected at least one request to /grc/itsm/incidents',
    }).toBeGreaterThanOrEqual(1);

    const req = itsmRequests[0];
    expect(req.authorization).toBeTruthy();
    expect(req.authorization).toMatch(/^Bearer .+/);
  });

  test('ITSM Services request includes Authorization header', async ({ page }) => {
    const itsmRequests: { url: string; authorization: string | null }[] = [];

    await login(page);

    await page.route('**/grc/itsm/services*', async (route) => {
      const request = route.request();
      itsmRequests.push({
        url: request.url(),
        authorization: request.headers()['authorization'] ?? null,
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
        }),
      });
    });

    await page.goto('/itsm/services');

    await expect.poll(() => itsmRequests.length, {
      timeout: 15000,
      message: 'Expected at least one request to /grc/itsm/services',
    }).toBeGreaterThanOrEqual(1);

    const req = itsmRequests[0];
    expect(req.authorization).toBeTruthy();
    expect(req.authorization).toMatch(/^Bearer .+/);
  });

  test('ITSM Changes shows error state on 401 instead of infinite spinner', async ({ page }) => {
    await login(page);

    await page.route('**/grc/itsm/changes*', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
        }),
      });
    });

    await page.goto('/itsm/changes');

    const loadingSpinner= page.locator('[role="progressbar"]');
    await expect(loadingSpinner).not.toBeVisible({ timeout: 10000 });
  });
});
