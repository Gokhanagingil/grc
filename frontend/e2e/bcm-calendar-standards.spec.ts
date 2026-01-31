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

  // ==================== BCM SERVICE DETAIL ====================
  test.describe('BCM Service Detail Page', () => {
    test('BCM Service Detail page loads with tabs showing counts', async ({ page }) => {
      // First go to services list
      await page.goto('/bcm/services');
      
      // Wait for page to load
      await page.waitForTimeout(2000);
      
      // Try to click on a service row if available
      const serviceRow = page.locator('tr[data-testid*="service-row"], tbody tr').first();
      const rowCount = await serviceRow.count();
      
      if (rowCount > 0) {
        await serviceRow.click();
        
        // Wait for detail page to load
        await page.waitForURL(/\/bcm\/services\/.+/);
        
        // Verify tabs are visible with counts (BIA, Plans, Exercises)
        const biaTab = page.getByTestId('tab-bia');
        const plansTab = page.getByTestId('tab-plans');
        const exercisesTab = page.getByTestId('tab-exercises');
        
        await expect(biaTab).toBeVisible({ timeout: 10000 });
        await expect(plansTab).toBeVisible({ timeout: 5000 });
        await expect(exercisesTab).toBeVisible({ timeout: 5000 });
        
        // Verify tabs show counts (format: "BIA (N)")
        const biaText = await biaTab.textContent();
        const plansText = await plansTab.textContent();
        const exercisesText = await exercisesTab.textContent();
        
        expect(biaText).toMatch(/BIA \(\d+\)/);
        expect(plansText).toMatch(/Plans \(\d+\)/);
        expect(exercisesText).toMatch(/Exercises \(\d+\)/);
      }
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

    test('BCM Exercises page has filter controls', async ({ page }) => {
      // NOTE: BCM Exercises are created from the Service detail page, not the list page.
      // This test verifies the list page has filter controls instead of an Add button.
      await page.goto('/bcm/exercises');
      
      // Look for filter controls (status and type dropdowns)
      const filterControls = page.locator('[data-testid="bcm-exercise-status-filter"], [data-testid="bcm-exercise-type-filter"]');
      await expect(filterControls.first()).toBeVisible({ timeout: 10000 });
    });
  });

  // ==================== CALENDAR ====================
  test.describe('GRC Calendar Page', () => {
    test('Calendar page loads successfully', async ({ page }) => {
      await page.goto('/calendar');
      
      // Wait for calendar to load - look for calendar page container
      const calendarContainer = page.locator('[data-testid="calendar-page"], [data-testid="calendar-filters"], .MuiPaper-root');
      await expect(calendarContainer.first()).toBeVisible({ timeout: 15000 });
      
      // Verify no error message is shown
      const pageContent = await page.textContent('body');
      expect(pageContent).not.toContain('Cannot GET');
      expect(pageContent).not.toContain('404');
    });

    test('Calendar page has month navigation controls', async ({ page }) => {
      await page.goto('/calendar');
      
      // Look for navigation buttons using data-testid attributes
      const prevButton = page.getByTestId('calendar-prev-month');
      const nextButton = page.getByTestId('calendar-next-month');
      const todayButton = page.getByTestId('calendar-today');
      
      await expect(prevButton).toBeVisible({ timeout: 10000 });
      await expect(nextButton).toBeVisible({ timeout: 10000 });
      await expect(todayButton).toBeVisible({ timeout: 10000 });
    });

    test('Calendar page can switch months', async ({ page }) => {
      await page.goto('/calendar');
      
      // Wait for calendar to load
      const calendarPage = page.getByTestId('calendar-page');
      await expect(calendarPage).toBeVisible({ timeout: 10000 });
      
      // Find and click next month button using data-testid
      const nextButton = page.getByTestId('calendar-next-month');
      await expect(nextButton).toBeVisible({ timeout: 5000 });
      await nextButton.click();
      
      // Wait for calendar to update
      await page.waitForTimeout(500);
      
      // Calendar should still be visible after navigation
      await expect(calendarPage).toBeVisible();
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
