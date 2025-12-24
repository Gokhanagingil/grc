import { test, expect } from '@playwright/test';
import { login, TEST_CREDENTIALS } from './helpers';

test.describe('Authentication', () => {
  test('Login page loads correctly', async ({ page }) => {
    await page.goto('/login');
    
    // Check page title
    await expect(page.getByTestId('page-login-title')).toBeVisible();
    await expect(page.getByTestId('page-login-title')).toContainText('GRC Platform Login');
    
    // Check form elements are present
    await expect(page.getByTestId('form-login')).toBeVisible();
    await expect(page.getByTestId('input-username')).toBeVisible();
    await expect(page.getByTestId('input-password')).toBeVisible();
    await expect(page.getByTestId('btn-submit-login')).toBeVisible();
  });

  test('Login with admin credentials works and redirects to dashboard', async ({ page }) => {
    await login(page);
    
    // Should be redirected to dashboard
    await expect(page).toHaveURL(/\/(dashboard|admin)/);
    
    // Should not see login form anymore
    await expect(page.getByTestId('form-login')).not.toBeVisible();
  });
});

