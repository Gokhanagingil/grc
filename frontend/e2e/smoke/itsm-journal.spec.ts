/**
 * ITSM Journal / Activity Stream Smoke Test
 *
 * Verifies: login -> open incident detail -> post work note -> entry appears.
 * Uses route interception so it works with or without a real backend.
 */

import { test, expect } from '@playwright/test';
import { login } from '../helpers';

const MOCK_INCIDENT_ID = '00000000-aaaa-bbbb-cccc-000000000001';

const mockIncident = {
  id: MOCK_INCIDENT_ID,
  number: 'INC-0001',
  shortDescription: 'Smoke test incident',
  description: 'Created for journal smoke test',
  state: 'open',
  priority: 'p3',
  impact: 'medium',
  urgency: 'medium',
  riskReviewRequired: false,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

test.describe('ITSM Journal smoke @mock', () => {
  test('post work note and verify it appears', async ({ page }) => {
    await login(page);

    let journalEntries: { id: string; type: string; message: string; createdAt: string; tableName: string; recordId: string }[] = [];

    await page.route('**/grc/itsm/incidents/' + MOCK_INCIDENT_ID, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockIncident }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/grc/itsm/incidents/' + MOCK_INCIDENT_ID + '/risks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.route('**/grc/itsm/incidents/' + MOCK_INCIDENT_ID + '/controls', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.route('**/grc/itsm/incidents/' + MOCK_INCIDENT_ID + '/journal**', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        const body = route.request().postDataJSON();
        const entry = {
          id: crypto.randomUUID(),
          type: body.type,
          message: body.message,
          createdAt: new Date().toISOString(),
          tableName: 'itsm_incidents',
          recordId: MOCK_INCIDENT_ID,
        };
        journalEntries.unshift(entry);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: entry }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              items: journalEntries,
              total: journalEntries.length,
              page: 1,
              pageSize: 50,
              totalPages: 1,
            },
          }),
        });
      }
    });

    await page.route('**/grc/itsm/choices**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: [], total: 0, page: 1, pageSize: 100, totalPages: 0 } }),
      });
    });

    await page.goto(`/itsm/incidents/${MOCK_INCIDENT_ID}`);

    const activityCard = page.locator('[data-testid="activity-stream"]');
    await expect(activityCard).toBeVisible({ timeout: 15000 });

    const workNoteToggle = page.locator('[data-testid="journal-type-work_note"]');
    await expect(workNoteToggle).toBeVisible({ timeout: 5000 });
    await workNoteToggle.click();

    const messageInput = page.locator('[data-testid="journal-message"]');
    await expect(messageInput).toBeVisible({ timeout: 5000 });
    await messageInput.fill('Smoke test work note entry');

    const postButton = page.locator('[data-testid="journal-post"]');
    await expect(postButton).toBeEnabled({ timeout: 3000 });
    await postButton.click();

    const journalEntry = page.locator('[data-testid="journal-entry"]');
    await expect(journalEntry.first()).toBeVisible({ timeout: 10000 });
    await expect(journalEntry.first()).toContainText('Smoke test work note entry');
  });
});
