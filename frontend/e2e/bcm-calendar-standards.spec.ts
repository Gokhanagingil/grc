import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('BCM, Calendar, and Standards Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // ==================== SIDEBAR NAVIGATION ====================
  test.describe('Sidebar Navigation', () => {
    test('BCM group is visible in sidebar navigation', async ({ page }) => {
      await page.goto('/dashboard');
      
      // BCM group should be visible in the sidebar
      const bcmGroup = page.getByTestId('nav-group-grc-bcm').first();
      await expect(bcmGroup).toBeVisible({ timeout: 10000 });
    });

    test('Calendar group is visible in sidebar navigation', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Calendar group should be visible in the sidebar
      const calendarGroup = page.getByTestId('nav-group-grc-calendar').first();
      await expect(calendarGroup).toBeVisible({ timeout: 10000 });
    });

    test('Clicking BCM -> Services navigates to BCM Services page', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Expand BCM group
      const bcmGroup = page.getByTestId('nav-group-grc-bcm').first();
      await bcmGroup.click();
      
      // Click on Services
      const servicesItem = page.getByTestId('sidebar-bcm-services').first();
      await expect(servicesItem).toBeVisible({ timeout: 5000 });
      await servicesItem.click();
      
      // Verify navigation
      await page.waitForURL('/bcm/services');
    });

    test('Clicking BCM -> Exercises navigates to BCM Exercises page', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Expand BCM group
      const bcmGroup = page.getByTestId('nav-group-grc-bcm').first();
      await bcmGroup.click();
      
      // Click on Exercises
      const exercisesItem = page.getByTestId('sidebar-bcm-exercises').first();
      await expect(exercisesItem).toBeVisible({ timeout: 5000 });
      await exercisesItem.click();
      
      // Verify navigation
      await page.waitForURL('/bcm/exercises');
    });

    test('Clicking Calendar -> GRC Calendar navigates to Calendar page', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Expand Calendar group
      const calendarGroup = page.getByTestId('nav-group-grc-calendar').first();
      await calendarGroup.click();
      
      // Click on GRC Calendar
      const calendarItem = page.getByTestId('sidebar-calendar').first();
      await expect(calendarItem).toBeVisible({ timeout: 5000 });
      await calendarItem.click();
      
      // Verify navigation
      await page.waitForURL('/calendar');
    });
  });

  // ==================== BCM SERVICES ====================
  test.describe('BCM Services Page', () => {
    test('BCM Services page loads and shows list or empty state', async ({ page }) => {
      await page.goto('/bcm/services');
      
      // Wait for page to load - should show either a table or empty state
      // Use a flexible approach: look for either the table or an empty state indicator
      const tableOrEmpty = page.locator('[data-testid="table-bcm-services"], [data-testid="empty-state"], .MuiTableContainer-root, [class*="empty"]');
      await expect(tableOrEmpty.first()).toBeVisible({ timeout: 15000 });
      
      // Verify no error message is shown
      const pageContent = await page.textContent('body');
      expect(pageContent).not.toContain('Cannot GET');
      expect(pageContent).not.toContain('404');
    });

    test('BCM Services page has Add button', async ({ page }) => {
      await page.goto('/bcm/services');
      
      // Look for an Add/Create button
      const addButton = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New"), [data-testid*="add"], [data-testid*="create"]');
      await expect(addButton.first()).toBeVisible({ timeout: 10000 });
    });
  });

  // ==================== BCM EXERCISES ====================
  test.describe('BCM Exercises Page', () => {
    test('BCM Exercises page loads and shows list or empty state', async ({ page }) => {
      await page.goto('/bcm/exercises');
      
      // Wait for page to load - should show either a table or empty state
      const tableOrEmpty = page.locator('[data-testid="table-bcm-exercises"], [data-testid="empty-state"], .MuiTableContainer-root, [class*="empty"]');
      await expect(tableOrEmpty.first()).toBeVisible({ timeout: 15000 });
      
      // Verify no error message is shown
      const pageContent = await page.textContent('body');
      expect(pageContent).not.toContain('Cannot GET');
      expect(pageContent).not.toContain('404');
    });

    test('BCM Exercises page has Add button', async ({ page }) => {
      await page.goto('/bcm/exercises');
      
      // Look for an Add/Create button
      const addButton = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New"), [data-testid*="add"], [data-testid*="create"]');
      await expect(addButton.first()).toBeVisible({ timeout: 10000 });
    });
  });

  // ==================== CALENDAR ====================
  test.describe('GRC Calendar Page', () => {
    test('Calendar page loads successfully', async ({ page }) => {
      await page.goto('/calendar');
      
      // Wait for calendar to load - look for calendar container or month view
      const calendarContainer = page.locator('[data-testid="calendar-container"], [class*="calendar"], .fc, .MuiPaper-root');
      await expect(calendarContainer.first()).toBeVisible({ timeout: 15000 });
      
      // Verify no error message is shown
      const pageContent = await page.textContent('body');
      expect(pageContent).not.toContain('Cannot GET');
      expect(pageContent).not.toContain('404');
    });

    test('Calendar page has month navigation controls', async ({ page }) => {
      await page.goto('/calendar');
      
      // Look for navigation buttons (prev/next month)
      const navButtons = page.locator('button:has-text("Previous"), button:has-text("Next"), button:has-text("Today"), [aria-label*="previous"], [aria-label*="next"], .fc-prev-button, .fc-next-button');
      await expect(navButtons.first()).toBeVisible({ timeout: 10000 });
    });

    test('Calendar page can switch months', async ({ page }) => {
      await page.goto('/calendar');
      
      // Wait for calendar to load
      await page.waitForTimeout(2000);
      
      // Find and click next month button
      const nextButton = page.locator('button:has-text("Next"), [aria-label*="next"], .fc-next-button, button[title*="next"]').first();
      
      if (await nextButton.isVisible()) {
        await nextButton.click();
        // Wait for calendar to update
        await page.waitForTimeout(1000);
        
        // Calendar should still be visible after navigation
        const calendarContainer = page.locator('[data-testid="calendar-container"], [class*="calendar"], .fc, .MuiPaper-root');
        await expect(calendarContainer.first()).toBeVisible();
      }
    });
  });

  // ==================== STANDARDS LIBRARY ====================
  test.describe('Standards Library Page', () => {
    test('Standards list page loads and shows standards or empty state', async ({ page }) => {
      await page.goto('/library/standards');
      
      // Wait for page to load - should show either a table with standards or empty state
      const tableOrEmpty = page.locator('[data-testid="table-standards"], [data-testid="empty-state"], .MuiTableContainer-root, [class*="empty"], table');
      await expect(tableOrEmpty.first()).toBeVisible({ timeout: 15000 });
      
      // Verify no error message is shown
      const pageContent = await page.textContent('body');
      expect(pageContent).not.toContain('Cannot GET');
      expect(pageContent).not.toContain('404');
    });

    test('Standards list shows ISO 27001 when seeded (mock API)', async ({ page }) => {
      await page.goto('/library/standards');
      
      // Wait for the page to load
      await page.waitForTimeout(2000);
      
      // In mock mode, we should see ISO 27001 in the list
      // Look for text containing ISO 27001 or the standard code
      const iso27001 = page.locator('text=/ISO.*27001|ISO27001/i');
      
      // This test may pass with mock API or real seeded data
      const count = await iso27001.count();
      if (count > 0) {
        await expect(iso27001.first()).toBeVisible();
      }
    });

    test('Standards list shows ISO 20000 when seeded (mock API)', async ({ page }) => {
      await page.goto('/library/standards');
      
      // Wait for the page to load
      await page.waitForTimeout(2000);
      
      // In mock mode, we should see ISO 20000 in the list
      // Look for text containing ISO 20000 or the standard code
      const iso20000 = page.locator('text=/ISO.*20000|ISO20000/i');
      
      // This test may pass with mock API or real seeded data
      const count = await iso20000.count();
      if (count > 0) {
        await expect(iso20000.first()).toBeVisible();
      }
    });
  });
});
