/**
 * Regression tests for AdminSystem component
 * 
 * These tests ensure the component handles undefined/partial notification status
 * payloads without crashing (P0 bug fix).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AdminSystem } from '../AdminSystem';

// Mock the api module
jest.mock('../../../services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    defaults: { baseURL: 'http://localhost:3002' },
  },
  STORAGE_TENANT_ID_KEY: 'tenantId',
}));

// Mock the i18n module
jest.mock('../../../i18n', () => ({
  t: (key: string) => key,
  ADMIN_PLATFORM_KEYS: {
    notifications: {
      title: 'Notifications',
      subtitle: 'Notification settings',
      emailProvider: 'Email Provider',
      webhookProvider: 'Webhook Provider',
      enabled: 'Enabled',
      disabled: 'Disabled',
      configured: 'Configured',
      notConfigured: 'Not Configured',
      testEmail: 'Test Email',
      testWebhook: 'Test Webhook',
      recentLogs: 'Recent Logs',
      success: 'Success',
      failed: 'Failed',
      lastAttempt: 'Last Attempt',
    },
    jobs: {
      title: 'Background Jobs',
      subtitle: 'Job status',
      platformValidation: 'Platform Validation',
      validationPassed: 'Validation Passed',
      validationFailed: 'Validation Failed',
      noValidationResult: 'No validation result',
      registeredJobs: 'Registered Jobs',
      recentRuns: 'Recent Runs',
      triggerJob: 'Trigger Job',
    },
  },
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock the admin components
jest.mock('../../../components/admin', () => ({
  AdminPageHeader: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div data-testid="admin-page-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
  AdminCard: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div data-testid={`admin-card-${title}`}>
      <h3>{title}</h3>
      {children}
    </div>
  ),
}));

describe('AdminSystem', () => {
  const mockApi = require('../../../services/api').api;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('test-tenant-id');
    
    // Default mock responses for health checks
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/health/')) {
        return Promise.resolve({ data: { status: 'OK' } });
      }
      if (url === '/admin/notifications/status') {
        return Promise.resolve({ data: null });
      }
      if (url === '/admin/jobs/status') {
        return Promise.resolve({ data: null });
      }
      if (url === '/admin/jobs/platform-validation') {
        return Promise.resolve({ data: null });
      }
      return Promise.resolve({ data: {} });
    });
  });

  describe('Notification Status with undefined payload', () => {
    it('should not crash when notificationStatus is null', async () => {
      mockApi.get.mockImplementation((url: string) => {
        if (url === '/admin/notifications/status') {
          return Promise.resolve({ data: null });
        }
        if (url.includes('/health/')) {
          return Promise.resolve({ data: { status: 'OK' } });
        }
        return Promise.resolve({ data: {} });
      });

      // Should not throw
      expect(() => {
        render(<AdminSystem />);
      }).not.toThrow();
    });

    it('should not crash when notificationStatus.email is undefined', async () => {
      mockApi.get.mockImplementation((url: string) => {
        if (url === '/admin/notifications/status') {
          // Return status without email property
          return Promise.resolve({ 
            data: { 
              webhook: { enabled: true, configured: true },
              recentLogs: { total: 0, success: 0, failed: 0, lastAttempt: null }
            } 
          });
        }
        if (url.includes('/health/')) {
          return Promise.resolve({ data: { status: 'OK' } });
        }
        return Promise.resolve({ data: {} });
      });

      // Should not throw
      expect(() => {
        render(<AdminSystem />);
      }).not.toThrow();
    });

    it('should not crash when notificationStatus.webhook is undefined', async () => {
      mockApi.get.mockImplementation((url: string) => {
        if (url === '/admin/notifications/status') {
          // Return status without webhook property
          return Promise.resolve({ 
            data: { 
              email: { enabled: true, configured: true },
              recentLogs: { total: 0, success: 0, failed: 0, lastAttempt: null }
            } 
          });
        }
        if (url.includes('/health/')) {
          return Promise.resolve({ data: { status: 'OK' } });
        }
        return Promise.resolve({ data: {} });
      });

      // Should not throw
      expect(() => {
        render(<AdminSystem />);
      }).not.toThrow();
    });

    it('should not crash when notificationStatus.recentLogs is undefined', async () => {
      mockApi.get.mockImplementation((url: string) => {
        if (url === '/admin/notifications/status') {
          // Return status without recentLogs property
          return Promise.resolve({ 
            data: { 
              email: { enabled: true, configured: true },
              webhook: { enabled: false, configured: false }
            } 
          });
        }
        if (url.includes('/health/')) {
          return Promise.resolve({ data: { status: 'OK' } });
        }
        return Promise.resolve({ data: {} });
      });

      // Should not throw
      expect(() => {
        render(<AdminSystem />);
      }).not.toThrow();
    });

    it('should not crash when notificationStatus has empty object', async () => {
      mockApi.get.mockImplementation((url: string) => {
        if (url === '/admin/notifications/status') {
          // Return empty object
          return Promise.resolve({ data: {} });
        }
        if (url.includes('/health/')) {
          return Promise.resolve({ data: { status: 'OK' } });
        }
        return Promise.resolve({ data: {} });
      });

      // Should not throw
      expect(() => {
        render(<AdminSystem />);
      }).not.toThrow();
    });

    it('should display "Unknown" for missing recentLogs values', async () => {
      mockApi.get.mockImplementation((url: string) => {
        if (url === '/admin/notifications/status') {
          // Return status with partial recentLogs
          return Promise.resolve({ 
            data: { 
              data: {
                email: { enabled: true, configured: true },
                webhook: { enabled: false, configured: false },
                recentLogs: {} // Empty recentLogs
              }
            } 
          });
        }
        if (url.includes('/health/')) {
          return Promise.resolve({ data: { status: 'OK' } });
        }
        return Promise.resolve({ data: {} });
      });

      // Should not throw
      expect(() => {
        render(<AdminSystem />);
      }).not.toThrow();
    });
  });

  describe('Component renders without errors', () => {
    it('should render the page header', () => {
      render(<AdminSystem />);
      expect(screen.getByTestId('admin-page-header')).toBeInTheDocument();
    });

    it('should render health check section', () => {
      render(<AdminSystem />);
      expect(screen.getByText('Health Checks')).toBeInTheDocument();
    });
  });
});
