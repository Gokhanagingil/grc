import { test, expect } from '@playwright/test';
import { login, setupMockApi } from '../helpers';

/**
 * Notification Bell Smoke Tests
 *
 * Verifies the Notification Center v0 bell icon, drawer, and notification display.
 * Uses MOCK_UI mode with intercepted API routes.
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
  // GET user-notifications
  page.route('**/grc/user-notifications*', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: MOCK_NOTIFICATIONS,
          total: MOCK_NOTIFICATIONS.length,
          unreadCount: MOCK_NOTIFICATIONS.filter((n) => !n.readAt).length,
          page: 1,
          pageSize: 20,
        }),
      });
    }
    return route.continue();
  });

  // PUT mark read
  page.route('**/grc/user-notifications/*/read', (route) => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ read: true }),
      });
    }
    return route.continue();
  });

  // PUT mark all read
  page.route('**/grc/user-notifications/read-all', (route) => {
    if (route.request().method() === 'PUT') {
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

    // Wait for notification bell to appear
    const bell = page.getByTestId('notification-bell');
    await expect(bell).toBeVisible({ timeout: 10000 });

    // Badge should show unread count (1 unread in mock data)
    const badge = bell.locator('.MuiBadge-badge');
    await expect(badge).toBeVisible({ timeout: 5000 });
    await expect(badge).toHaveText('1');
  });

  test('clicking bell opens notification drawer with items', async ({ page }) => {
    await login(page);
    setupNotificationMocks(page);

    // Click the bell
    const bell = page.getByTestId('notification-bell');
    await expect(bell).toBeVisible({ timeout: 10000 });
    await bell.click();

    // Drawer should open with notifications header
    await expect(page.getByText('Notifications')).toBeVisible({ timeout: 5000 });

    // Should show notification items
    await expect(page.getByText('Task Assigned')).toBeVisible();
    await expect(page.getByText('Task Due Soon')).toBeVisible();

    // Should show source chip for TODO
    await expect(page.getByText('To-Do')).toBeVisible();

    // Should show WARNING severity chip
    await expect(page.getByText('WARNING')).toBeVisible();

    // Should show action button
    await expect(page.getByRole('button', { name: 'Open Task' }).first()).toBeVisible();
  });

  test('mark all read clears unread state', async ({ page }) => {
    await login(page);
    setupNotificationMocks(page);

    // Open drawer
    const bell = page.getByTestId('notification-bell');
    await expect(bell).toBeVisible({ timeout: 10000 });
    await bell.click();

    // Click "Mark all read"
    const markAllBtn = page.getByRole('button', { name: 'Mark all read' });
    await expect(markAllBtn).toBeVisible({ timeout: 5000 });
    await markAllBtn.click();

    // Mark all read button should disappear (no more unread)
    await expect(markAllBtn).not.toBeVisible({ timeout: 5000 });
  });
});
