import { test, expect } from '@playwright/test';
import { login } from '../helpers';

/**
 * Notification Bell Smoke Tests
 *
 * Verifies the Notification Center v0 bell icon, drawer, and notification display.
 * Uses MOCK_UI mode with intercepted API routes.
 *
 * IMPORTANT: Notification mocks must be registered AFTER login() because login()
 * calls setupMockApi() which registers a catch-all route handler.
 * Playwright routes are LIFO, so our specific handlers must come after the
 * catch-all to take priority. We then reload the page so the NotificationBell
 * component remounts and fetches with our mocked data.
 *
 * @tag @mock
 */

const MOCK_NOTIFICATIONS = [
  {
    id: '00000000-0000-0000-0000-000000000101',
    title: 'Task Assigned',
    body: 'You have been assigned to "Fix login bug".',
    type: 'ASSIGNMENT',
    severity: 'INFO',
    source: 'TODO',
    entityType: 'todo_task',
    entityId: '00000000-0000-0000-0000-000000000201',
    link: '/todo_task/00000000-0000-0000-0000-000000000201',
    dueAt: null,
    actions: [
      {
        label: 'Open Task',
        actionType: 'OPEN_RECORD',
        payload: {
          entityType: 'todo_task',
          entityId: '00000000-0000-0000-0000-000000000201',
        },
      },
    ],
    metadata: {},
    readAt: null,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000102',
    title: 'Task Due Soon',
    body: '"Deploy feature" is due on 2026-03-05.',
    type: 'DUE_DATE',
    severity: 'WARNING',
    source: 'TODO',
    entityType: 'todo_task',
    entityId: '00000000-0000-0000-0000-000000000202',
    link: '/todo_task/00000000-0000-0000-0000-000000000202',
    dueAt: '2026-03-05T12:00:00Z',
    actions: [
      {
        label: 'Open Task',
        actionType: 'OPEN_RECORD',
        payload: {
          entityType: 'todo_task',
          entityId: '00000000-0000-0000-0000-000000000202',
        },
      },
    ],
    metadata: {},
    readAt: '2026-03-02T10:00:00Z',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];

function setupNotificationMocks(page: import('@playwright/test').Page) {
  const unreadCount = MOCK_NOTIFICATIONS.filter((n) => !n.readAt).length;

  // GET user-notifications (generic — registered first)
  page.route('**/grc/user-notifications*', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: MOCK_NOTIFICATIONS,
          total: MOCK_NOTIFICATIONS.length,
          unreadCount,
          page: 1,
          pageSize: 20,
        }),
      });
    }
    return route.continue();
  });

  // GET unread-count (registered AFTER generic route — Playwright LIFO gives last-registered priority)
  page.route('**/grc/user-notifications/unread-count*', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ unreadCount }),
      });
    }
    return route.continue();
  });

  // POST mark read
  page.route('**/grc/user-notifications/*/read', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ read: true }),
      });
    }
    return route.continue();
  });

  // POST mark all read
  page.route('**/grc/user-notifications/read-all', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ markedRead: 1 }),
      });
    }
    return route.continue();
  });
}

test.describe('Notification Bell @mock', () => {
  test('bell icon shows unread badge count', async ({ page }) => {
    await login(page);
    setupNotificationMocks(page);
    await page.reload();

    // Wait for notification bell to appear
    const bell = page.getByTestId('notification-bell');
    await expect(bell).toBeVisible({ timeout: 10000 });

    // Badge should show unread count (1 unread in mock data)
    const badge = bell.locator('.MuiBadge-badge:not(.MuiBadge-invisible)');
    await expect(badge).toBeVisible({ timeout: 5000 });
    await expect(badge).toHaveText('1');
  });

  test('clicking bell opens notification drawer with items', async ({ page }) => {
    await login(page);
    setupNotificationMocks(page);
    await page.reload();

    // Click the bell (force: true because pulse animation makes it "not stable")
    const bell = page.getByTestId('notification-bell');
    await expect(bell).toBeVisible({ timeout: 10000 });
    await bell.click({ force: true });

    // Drawer should open with notifications header
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible({ timeout: 5000 });

    // Should show notification items
    await expect(page.getByText('Task Assigned')).toBeVisible();
    await expect(page.getByText('Task Due Soon')).toBeVisible();

    // Should show source chip for TODO (scoped to drawer to avoid matching nav items)
    const drawer = page.getByTestId('notification-drawer');
    await expect(drawer.getByText('To-Do').first()).toBeVisible();

    // Should show WARNING severity chip
    await expect(drawer.getByText('WARNING')).toBeVisible();

    // Expand a notification to reveal the smart preview card with action buttons
    await page.getByText('Task Assigned').click();

    // Should show the generic "Open" action button inside the expanded card
    await expect(drawer.getByRole('button', { name: 'Open' }).first()).toBeVisible({ timeout: 5000 });
  });

  test('mark all read clears unread state', async ({ page }) => {
    await login(page);
    setupNotificationMocks(page);
    await page.reload();

    // Open drawer (force: true because pulse animation makes it "not stable")
    const bell = page.getByTestId('notification-bell');
    await expect(bell).toBeVisible({ timeout: 10000 });
    await bell.click({ force: true });

    // Click "Mark all as read" icon button
    const markAllBtn = page.getByRole('button', { name: /mark all/i });
    await expect(markAllBtn).toBeVisible({ timeout: 5000 });
    await markAllBtn.click();

    // Mark all read button should disappear (no more unread)
    await expect(markAllBtn).not.toBeVisible({ timeout: 5000 });
  });
});
