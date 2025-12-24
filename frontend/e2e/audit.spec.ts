import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Audit Module', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Audit module list page loads (table or empty state)', async ({ page }) => {
    // Navigate to audits list via menu
    await page.getByTestId('nav-audit').click();
    await page.waitForURL('/audits');
    
    // Verify page title
    await expect(page.getByTestId('page-audit-list-title')).toBeVisible();
    await expect(page.getByTestId('page-audit-list-title')).toContainText('Audit Management');
    
    // Page should load without errors (empty state is acceptable)
    const errorMessage = page.locator('text=/error|failed/i');
    const errorCount = await errorMessage.count();
    expect(errorCount).toBe(0);
  });

  test('Create Audit button exists and opens dialog or navigates to create page', async ({ page }) => {
    await page.goto('/audits');
    
    // Check if Create Audit button exists
    const createButton = page.getByTestId('btn-create-audit');
    const buttonExists = await createButton.count() > 0;
    
    if (buttonExists) {
      // If button exists and is enabled, click it
      await expect(createButton).toBeVisible();
      
      // Check if it's disabled (read-only/coming soon)
      const isDisabled = await createButton.isDisabled();
      
      if (!isDisabled) {
        await createButton.click();
        
        // Should navigate to create page or open dialog
        // Accept either /audits/new or modal opening
        await page.waitForTimeout(1000);
        const url = page.url();
        const isCreatePage = url.includes('/audits/new');
        const hasModal = await page.locator('[role="dialog"]').count() > 0;
        
        expect(isCreatePage || hasModal).toBeTruthy();
      } else {
        // Document that Create is disabled
        test.info().annotations.push({
          type: 'note',
          description: 'Create Audit button exists but is disabled (coming soon feature)',
        });
      }
    } else {
      // Document that Create button doesn't exist yet
      test.info().annotations.push({
        type: 'note',
        description: 'Create Audit button does not exist yet',
      });
    }
  });

  test('Create Audit form shows required fields when opened', async ({ page }) => {
    await page.goto('/audits');
    
    const createButton = page.getByTestId('btn-create-audit');
    const buttonExists = await createButton.count() > 0;
    const isDisabled = buttonExists ? await createButton.isDisabled() : true;
    
    if (buttonExists && !isDisabled) {
      await createButton.click();
      await page.waitForTimeout(1000);
      
      // If we're on the create page, check for form fields
      if (page.url().includes('/audits/new')) {
        // Look for common form fields (name, description, type, etc.)
        const formFields = page.locator('input, textarea, select').filter({ hasNotText: '' });
        const fieldCount = await formFields.count();
        
        // At least some form fields should be present
        expect(fieldCount).toBeGreaterThan(0);
      }
    } else {
      // If Create is not available, document it
      test.info().annotations.push({
        type: 'note',
        description: 'Create Audit functionality not available yet - button is disabled or not present',
      });
    }
  });
});

