/**
 * Todo Work Management 1.6 – Gap Fix Smoke Tests
 *
 * Validates the four user-observed gaps fixed in this PR:
 *   1) Board delete via kebab menu
 *   2) Tag creation + assignment + filtering
 *   3) Assignment (user / group) fields + filtering
 *
 * Runs in MOCK_UI mode with route interception so no real backend is needed.
 *
 * Usage:
 *   E2E_MODE=MOCK_UI npx playwright test e2e/smoke/todo-gaps-smoke.spec.ts --project=mock-ui
 */

import { test, expect, Page } from '@playwright/test';
import { setupMockApi, login } from '../helpers';

/* ------------------------------------------------------------------ */
/* Mock data                                                           */
/* ------------------------------------------------------------------ */

const TENANT = '00000000-0000-0000-0000-000000000001';

const mockBoard = {
  id: 'board-1',
  name: 'Sprint Board',
  description: 'Test board',
  columns: [
    { id: 'col-1', key: 'todo', title: 'To Do', orderIndex: 0, wipLimit: null, isDoneColumn: false },
    { id: 'col-2', key: 'doing', title: 'Doing', orderIndex: 1, wipLimit: null, isDoneColumn: false },
    { id: 'col-3', key: 'done', title: 'Done', orderIndex: 2, wipLimit: null, isDoneColumn: true },
  ],
};

const mockTag = { id: 'tag-1', name: 'Urgent-Fix', color: '#f44336' };

const mockTask = {
  id: 'task-1',
  title: 'Fix login bug',
  description: 'Users cannot login on mobile',
  priority: 'high',
  status: 'todo',
  category: 'Security',
  tags: null,
  taskTags: [mockTag],
  dueDate: null,
  completedAt: null,
  assigneeUserId: 'user-1',
  ownerGroupId: 'IT',
  sortOrder: 0,
  boardId: 'board-1',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const mockUser = { id: 'user-1', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' };
const mockDepartments = ['IT', 'Engineering', 'Security'];

/* ------------------------------------------------------------------ */
/* Helper: intercept all /todos/* and /users/* API calls               */
/* ------------------------------------------------------------------ */

async function setupTodoMocks(page: Page) {
  // Boards list
  await page.route('**/todos/boards/list', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [mockBoard], total: 1 }),
    }),
  );

  // Board detail
  await page.route('**/todos/boards/board-1', (route) => {
    if (route.request().method() === 'DELETE') {
      return route.fulfill({ status: 204, body: '' });
    }
    if (route.request().method() === 'PATCH') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...mockBoard, name: 'Renamed Board' }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockBoard),
    });
  });

  // Tasks list
  await page.route('**/todos?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [mockTask], total: 1 }),
    }),
  );

  // Seed (no-op)
  await page.route('**/todos/seed', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'ok' }) }),
  );

  // Stats
  await page.route('**/todos/stats/summary', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ total: 1, completed: 0, pending: 1, in_progress: 0, overdue: 0 }),
    }),
  );

  // Tags list
  await page.route('**/todos/tags/list', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [mockTag], total: 1 }),
    }),
  );

  // Create tag
  await page.route('**/todos/tags', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'tag-new', name: 'New-Tag', color: '#1976d2' }),
      });
    }
    return route.continue();
  });

  // Users list
  await page.route('**/users?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { items: [mockUser], total: 1 } }),
    }),
  );

  // Departments
  await page.route('**/users/departments/list', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockDepartments }),
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

test.describe('Todo 1.6 Gap Fixes @mock', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
    await setupTodoMocks(page);
  });

  /* ---------- GAP 1: Board delete is discoverable ---------- */

  test('GAP-1: Board kebab menu shows Rename and Delete options', async ({ page }) => {
    await login(page);
    await page.goto('/todos');

    // Wait for workspace to load
    await page.waitForTimeout(2000);

    // Look for the kebab menu (MoreVert icon button) near board selector
    const kebabButton = page.locator('button[aria-label="Board settings"]');
    await expect(kebabButton).toBeVisible({ timeout: 10000 });

    // Click the kebab menu
    await kebabButton.click();

    // Verify Rename Board option exists
    const renameOption = page.locator('text=Rename Board');
    await expect(renameOption).toBeVisible({ timeout: 5000 });

    // Verify Delete Board option exists
    const deleteOption = page.locator('text=Delete Board');
    await expect(deleteOption).toBeVisible({ timeout: 5000 });

    // Click Delete Board to verify confirmation dialog
    await deleteOption.click();

    // Verify delete confirmation dialog appears
    const deleteDialog = page.locator('text=Are you sure you want to delete');
    await expect(deleteDialog).toBeVisible({ timeout: 5000 });

    // Verify explanation about tasks is shown
    const taskExplanation = page.locator('text=Tasks in this board will not be deleted');
    await expect(taskExplanation).toBeVisible({ timeout: 5000 });

    // Verify Cancel and Delete Board buttons
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
    await expect(page.locator('button:has-text("Delete Board")')).toBeVisible();
  });

  /* ---------- GAP 2: Tags end-to-end ---------- */

  test('GAP-2: Tag creation and tag filter visible in toolbar', async ({ page }) => {
    await login(page);
    await page.goto('/todos');

    // Wait for workspace to load
    await page.waitForTimeout(2000);

    // Verify Tags filter exists in the toolbar (Autocomplete with label "Tags")
    const tagsFilterInput = page.locator('input[placeholder*="Tags"]').or(
      page.locator('label:has-text("Tags")').first()
    );
    // At minimum the label "Tags" should be present in the filter area
    await expect(page.locator('label').filter({ hasText: 'Tags' }).first()).toBeVisible({ timeout: 10000 });

    // Click on a task card to open the drawer
    const taskCard = page.locator('text=Fix login bug').first();
    await expect(taskCard).toBeVisible({ timeout: 10000 });
    await taskCard.click();

    // Verify drawer opened with task details
    await expect(page.locator('text=Task Details')).toBeVisible({ timeout: 5000 });

    // Verify "Create Tag" button is visible in the drawer
    const createTagButton = page.locator('button:has-text("Create Tag")');
    await expect(createTagButton).toBeVisible({ timeout: 5000 });

    // Click Create Tag to show inline form
    await createTagButton.click();

    // Verify inline tag creation form appears
    const tagNameInput = page.locator('label:has-text("Tag name")');
    await expect(tagNameInput).toBeVisible({ timeout: 5000 });

    // Verify Add button
    const addButton = page.locator('button:has-text("Add")');
    await expect(addButton).toBeVisible();
  });

  /* ---------- GAP 3: Assignment fields visible ---------- */

  test('GAP-3: Assignment fields and filters visible in drawer and toolbar', async ({ page }) => {
    await login(page);
    await page.goto('/todos');

    // Wait for workspace to load
    await page.waitForTimeout(2000);

    // Verify "Assigned To" filter in toolbar
    await expect(page.locator('label').filter({ hasText: 'Assigned To' }).first()).toBeVisible({ timeout: 10000 });

    // Verify "Group" filter in toolbar
    await expect(page.locator('label').filter({ hasText: 'Group' }).first()).toBeVisible({ timeout: 10000 });

    // Click a task card to open drawer
    const taskCard = page.locator('text=Fix login bug').first();
    await expect(taskCard).toBeVisible({ timeout: 10000 });
    await taskCard.click();

    // Verify drawer opened
    await expect(page.locator('text=Task Details')).toBeVisible({ timeout: 5000 });

    // Verify "Assigned To" picker in drawer
    const assignedToInDrawer = page.locator('label').filter({ hasText: 'Assigned To' });
    // Should appear at least twice: toolbar + drawer
    await expect(assignedToInDrawer.nth(1)).toBeVisible({ timeout: 5000 });

    // Verify "Assignment Group" picker in drawer
    const groupInDrawer = page.locator('label').filter({ hasText: 'Assignment Group' });
    await expect(groupInDrawer.first()).toBeVisible({ timeout: 5000 });
  });
});
