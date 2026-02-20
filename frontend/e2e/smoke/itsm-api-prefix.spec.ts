/**
 * ITSM API Prefix Smoke Test
 *
 * Verifies that all ITSM API calls use the /api prefix so they pass through
 * the nginx reverse proxy instead of hitting Cloudflare directly.
 *
 * Root cause: Frontend was calling /grc/itsm/* instead of /api/grc/itsm/*,
 * causing Cloudflare managed challenge (403 "Just a moment…") HTML responses.
 */

import { test, expect } from '@playwright/test';
import { login, setupMockApi } from '../helpers';

const isMockMode = process.env.E2E_MOCK_API === '1';

test.describe('ITSM API prefix verification', () => {
  test.skip(isMockMode, 'Requires real or proxy backend');

  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  test('Services list calls /api/grc/itsm/services', async ({ page }) => {
    await login(page);

    const requestPromise = page.waitForRequest(
      (req) => req.url().includes('/grc/itsm/services') && req.method() === 'GET',
      { timeout: 20000 },
    );

    await page.goto('/itsm/services');
    const req = await requestPromise;

    expect(req.url()).toContain('/api/grc/itsm/services');
    expect(req.url()).not.toMatch(/(?<!\/)\/grc\/itsm\/services/);
  });

  test('Incidents list calls /api/grc/itsm/incidents', async ({ page }) => {
    await login(page);

    const requestPromise = page.waitForRequest(
      (req) => req.url().includes('/grc/itsm/incidents') && req.method() === 'GET',
      { timeout: 20000 },
    );

    await page.goto('/itsm/incidents');
    const req = await requestPromise;

    expect(req.url()).toContain('/api/grc/itsm/incidents');
  });

  test('Changes list calls /api/grc/itsm/changes', async ({ page }) => {
    await login(page);

    const requestPromise = page.waitForRequest(
      (req) => req.url().includes('/grc/itsm/changes') && req.method() === 'GET',
      { timeout: 20000 },
    );

    await page.goto('/itsm/changes');
    const req = await requestPromise;

    expect(req.url()).toContain('/api/grc/itsm/changes');
  });
});
