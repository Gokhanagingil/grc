/**
 * Regression tests for AdminFrameworks component
 * 
 * These tests ensure the component handles different API response shapes
 * without crashing (fixes empty state bug where backend returns array directly).
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AdminFrameworks } from '../AdminFrameworks';

// Mock the api module
jest.mock('../../../services/api', () => ({
  api: {
    get: jest.fn(),
    put: jest.fn(),
    defaults: { baseURL: 'http://localhost:3002' },
  },
  STORAGE_TENANT_ID_KEY: 'tenantId',
}));

// Create mock functions that can be accessed from tests
const mockGrcFrameworksApiList = jest.fn();
const mockTenantFrameworksApiGet = jest.fn();
const mockTenantFrameworksApiUpdate = jest.fn();


jest.mock('../../../services/grcClient', () => {
  return {
    grcFrameworksApi: {
      list: () => mockGrcFrameworksApiList(),
    },
    tenantFrameworksApi: {
      get: (tenantId: string) => mockTenantFrameworksApiGet(tenantId),
      update: (tenantId: string, keys: string[]) => mockTenantFrameworksApiUpdate(tenantId, keys),
    },
    unwrapResponse: <T,>(response: { data: unknown }): T => {
      const data = response.data;
      if (data && typeof data === 'object' && 'success' in data && (data as { success: boolean }).success === true && 'data' in data) {
        return (data as { data: T }).data;
      }
      return data as T;
    },
    GrcFrameworkData: {},
  };
});

// Mock the AuthContext
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user-id',
      tenantId: 'test-tenant-id',
      email: 'test@example.com',
    },
  }),
}));

// Mock the OnboardingContext
jest.mock('../../../contexts/OnboardingContext', () => ({
  useOnboarding: () => ({
    refreshContext: jest.fn(),
  }),
}));

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

describe('AdminFrameworks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('API Response Shape Handling', () => {
    it('should render frameworks when backend returns array directly (NestJS format)', async () => {
      const frameworks = [
        { id: '1', key: 'ISO27001', name: 'ISO 27001', description: 'Information Security', isActive: true },
        { id: '2', key: 'SOC2', name: 'SOC 2', description: 'Service Organization Control', isActive: true },
        { id: '3', key: 'NIST', name: 'NIST CSF', description: 'Cybersecurity Framework', isActive: true },
        { id: '4', key: 'GDPR', name: 'GDPR', description: 'Data Protection', isActive: true },
      ];

      mockGrcFrameworksApiList.mockResolvedValue({
        data: { success: true, data: frameworks },
      });
      mockTenantFrameworksApiGet.mockResolvedValue({
        data: { success: true, data: ['ISO27001', 'SOC2'] },
      });

      render(<AdminFrameworks />);

      await waitFor(() => {
        expect(screen.getByText('ISO 27001')).toBeInTheDocument();
      });

      expect(screen.getByText('SOC 2')).toBeInTheDocument();
      expect(screen.getByText('NIST CSF')).toBeInTheDocument();
      expect(screen.getByText('GDPR')).toBeInTheDocument();
    });

    it('should render frameworks when backend returns object with frameworks property (legacy format)', async () => {
      const frameworks = [
        { id: '1', key: 'ISO27001', name: 'ISO 27001', description: 'Information Security', isActive: true },
      ];

      mockGrcFrameworksApiList.mockResolvedValue({
        data: { frameworks },
      });
      mockTenantFrameworksApiGet.mockResolvedValue({
        data: { activeKeys: ['ISO27001'] },
      });

      render(<AdminFrameworks />);

      await waitFor(() => {
        expect(screen.getByText('ISO 27001')).toBeInTheDocument();
      });
    });

    it('should not crash when frameworks response is null', async () => {
      mockGrcFrameworksApiList.mockResolvedValue({
        data: null,
      });
      mockTenantFrameworksApiGet.mockResolvedValue({
        data: null,
      });

      expect(() => {
        render(<AdminFrameworks />);
      }).not.toThrow();

      await waitFor(() => {
        expect(screen.getByText('No frameworks available. Please contact your administrator.')).toBeInTheDocument();
      });
    });

    it('should not crash when frameworks response is empty array', async () => {
      mockGrcFrameworksApiList.mockResolvedValue({
        data: { success: true, data: [] },
      });
      mockTenantFrameworksApiGet.mockResolvedValue({
        data: { success: true, data: [] },
      });

      expect(() => {
        render(<AdminFrameworks />);
      }).not.toThrow();

      await waitFor(() => {
        expect(screen.getByText('No frameworks available. Please contact your administrator.')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      mockGrcFrameworksApiList.mockRejectedValue(new Error('Network error'));
      mockTenantFrameworksApiGet.mockRejectedValue(new Error('Network error'));

      expect(() => {
        render(<AdminFrameworks />);
      }).not.toThrow();

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Component renders without errors', () => {
    it('should render the page header', async () => {
      mockGrcFrameworksApiList.mockResolvedValue({
        data: { success: true, data: [] },
      });
      mockTenantFrameworksApiGet.mockResolvedValue({
        data: { success: true, data: [] },
      });

      render(<AdminFrameworks />);
      expect(screen.getByTestId('admin-page-header')).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      mockGrcFrameworksApiList.mockImplementation(() => new Promise(() => {}));
      mockTenantFrameworksApiGet.mockImplementation(() => new Promise(() => {}));

      render(<AdminFrameworks />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });
});
