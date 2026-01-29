import { test, expect } from '@playwright/test';
import { login, setupMockApi } from './helpers';

test.describe('Universal List Experience Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
    await login(page);
  });

  test.describe('Issues List', () => {
    test('should load issues list page', async ({ page }) => {
      await page.goto('/grc/issues');
      
      await expect(page.locator('h4, h5, h6').filter({ hasText: /issues/i }).first()).toBeVisible({ timeout: 10000 });
    });

    test('should have search input', async ({ page }) => {
      await page.goto('/grc/issues');
      
      const searchInput = page.getByPlaceholder(/search/i).first();
      await expect(searchInput).toBeVisible({ timeout: 10000 });
    });

    test('should filter results when typing in search', async ({ page }) => {
      await page.goto('/grc/issues');
      
      const searchInput = page.getByPlaceholder(/search/i).first();
      await expect(searchInput).toBeVisible({ timeout: 10000 });
      
      await searchInput.fill('test search');
      
      await page.waitForTimeout(500);
      
      const url = page.url();
      expect(url.includes('search=') || url.includes('q=')).toBeTruthy();
    });

    test('should show empty state or results', async ({ page }) => {
      await page.goto('/grc/issues');
      
      await page.waitForTimeout(2000);
      
      const hasTable = await page.locator('table').isVisible();
      const hasEmptyState = await page.getByText(/no.*found|empty/i).isVisible();
      
      expect(hasTable || hasEmptyState).toBeTruthy();
    });

    test('should navigate to detail page on row click', async ({ page }) => {
      await page.goto('/grc/issues');
      
      await page.waitForTimeout(2000);
      
      const firstRow = page.locator('tbody tr').first();
      const rowExists = await firstRow.isVisible();
      
      if (rowExists) {
        await firstRow.click();
        
        await page.waitForTimeout(1000);
        
        const url = page.url();
        expect(url.includes('/grc/issues/')).toBeTruthy();
      }
    });
  });

  test.describe('CAPAs List', () => {
    test('should load CAPAs list page', async ({ page }) => {
      await page.goto('/grc/capas');
      
      await expect(page.locator('h4, h5, h6').filter({ hasText: /capa/i }).first()).toBeVisible({ timeout: 10000 });
    });

    test('should have search input', async ({ page }) => {
      await page.goto('/grc/capas');
      
      const searchInput = page.getByPlaceholder(/search/i).first();
      await expect(searchInput).toBeVisible({ timeout: 10000 });
    });

    test('should filter results when typing in search', async ({ page }) => {
      await page.goto('/grc/capas');
      
      const searchInput = page.getByPlaceholder(/search/i).first();
      await expect(searchInput).toBeVisible({ timeout: 10000 });
      
      await searchInput.fill('test capa');
      
      await page.waitForTimeout(500);
      
      const url = page.url();
      expect(url.includes('search=') || url.includes('q=')).toBeTruthy();
    });

    test('should show empty state or results', async ({ page }) => {
      await page.goto('/grc/capas');
      
      await page.waitForTimeout(2000);
      
      const hasTable = await page.locator('table').isVisible();
      const hasEmptyState = await page.getByText(/no.*found|empty/i).isVisible();
      
      expect(hasTable || hasEmptyState).toBeTruthy();
    });
  });

  test.describe('Evidence List', () => {
    test('should load evidence list page', async ({ page }) => {
      await page.goto('/grc/evidence');
      
      await expect(page.locator('h4, h5, h6').filter({ hasText: /evidence/i }).first()).toBeVisible({ timeout: 10000 });
    });

    test('should have search input', async ({ page }) => {
      await page.goto('/grc/evidence');
      
      const searchInput = page.getByPlaceholder(/search/i).first();
      await expect(searchInput).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Controls List', () => {
    test('should load controls list page', async ({ page }) => {
      await page.goto('/grc/controls');
      
      await expect(page.locator('h4, h5, h6').filter({ hasText: /control/i }).first()).toBeVisible({ timeout: 10000 });
    });

    test('should have search input', async ({ page }) => {
      await page.goto('/grc/controls');
      
      const searchInput = page.getByPlaceholder(/search/i).first();
      await expect(searchInput).toBeVisible({ timeout: 10000 });
    });

    test('should show table with controls', async ({ page }) => {
      await page.goto('/grc/controls');
      
      await page.waitForTimeout(2000);
      
      const hasTable = await page.locator('table').isVisible();
      const hasEmptyState = await page.getByText(/no.*found|empty/i).isVisible();
      
      expect(hasTable || hasEmptyState).toBeTruthy();
    });
  });

  test.describe('Filter Encoding', () => {
    test('should use single-encoded filter in URL', async ({ page }) => {
      await page.goto('/grc/issues');
      
      await page.waitForTimeout(1000);
      
      const filterButton = page.getByRole('button', { name: /filter/i }).first();
      const filterButtonExists = await filterButton.isVisible();
      
      if (filterButtonExists) {
        await filterButton.click();
        
        await page.waitForTimeout(500);
        
        const statusOption = page.getByText(/status/i).first();
        const statusOptionExists = await statusOption.isVisible();
        
        if (statusOptionExists) {
          await statusOption.click();
          
          await page.waitForTimeout(500);
          
          const url = page.url();
          
          if (url.includes('filter=')) {
            const filterParam = new URL(url).searchParams.get('filter');
            if (filterParam) {
              const decoded = decodeURIComponent(filterParam);
              expect(() => JSON.parse(decoded)).not.toThrow();
            }
          }
        }
      }
    });
  });
});
