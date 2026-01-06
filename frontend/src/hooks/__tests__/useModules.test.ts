/**
 * Unit tests for useModules hook
 * 
 * Tests the envelope unwrap logic for /platform/modules/enabled endpoint.
 * Ensures isModuleEnabled returns correct values for both envelope and direct response formats.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useModules } from '../useModules';
import { moduleApi } from '../../services/platformApi';

// Mock the platformApi module
jest.mock('../../services/platformApi', () => ({
  moduleApi: {
    getEnabled: jest.fn(),
    getStatus: jest.fn(),
    getMenu: jest.fn(),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockModuleApi = moduleApi as any;

describe('useModules hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('envelope unwrap for /platform/modules/enabled', () => {
    it('should correctly parse envelope response format: { success: true, data: { enabledModules: [...] } }', async () => {
      // This is the format returned by staging nginx proxy
      const envelopeResponse = {
        data: {
          success: true,
          data: {
            tenantId: 'test-tenant-id',
            enabledModules: ['grc', 'itsm', 'audit', 'risk', 'compliance', 'policy'],
          },
        },
      };

      mockModuleApi.getEnabled.mockResolvedValue(envelopeResponse);
      mockModuleApi.getStatus.mockResolvedValue({
        data: { success: true, data: { tenantId: 'test-tenant-id', modules: [] } },
      });
      mockModuleApi.getMenu.mockResolvedValue({
        data: { success: true, data: { tenantId: 'test-tenant-id', menuItems: [] } },
      });

      const { result } = renderHook(() => useModules());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify audit module is enabled
      expect(result.current.isModuleEnabled('audit')).toBe(true);
      expect(result.current.isModuleEnabled('risk')).toBe(true);
      expect(result.current.isModuleEnabled('policy')).toBe(true);
      expect(result.current.isModuleEnabled('compliance')).toBe(true);
      
      // Verify enabledModules array is correctly populated
      expect(result.current.enabledModules).toContain('audit');
      expect(result.current.enabledModules).toContain('risk');
      expect(result.current.enabledModules).toHaveLength(6);
    });

    it('should correctly parse direct response format: { tenantId, enabledModules: [...] }', async () => {
      // This is the legacy/direct format without envelope
      const directResponse = {
        data: {
          tenantId: 'test-tenant-id',
          enabledModules: ['audit', 'risk', 'policy'],
        },
      };

      mockModuleApi.getEnabled.mockResolvedValue(directResponse);
      mockModuleApi.getStatus.mockResolvedValue({
        data: { tenantId: 'test-tenant-id', modules: [] },
      });
      mockModuleApi.getMenu.mockResolvedValue({
        data: { tenantId: 'test-tenant-id', menuItems: [] },
      });

      const { result } = renderHook(() => useModules());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify modules are enabled
      expect(result.current.isModuleEnabled('audit')).toBe(true);
      expect(result.current.isModuleEnabled('risk')).toBe(true);
      expect(result.current.isModuleEnabled('policy')).toBe(true);
      
      // Verify non-enabled module returns false
      expect(result.current.isModuleEnabled('compliance')).toBe(false);
    });

    it('should return false for isModuleEnabled when module is not in enabledModules', async () => {
      const envelopeResponse = {
        data: {
          success: true,
          data: {
            tenantId: 'test-tenant-id',
            enabledModules: ['risk', 'policy'],
          },
        },
      };

      mockModuleApi.getEnabled.mockResolvedValue(envelopeResponse);
      mockModuleApi.getStatus.mockResolvedValue({
        data: { success: true, data: { tenantId: 'test-tenant-id', modules: [] } },
      });
      mockModuleApi.getMenu.mockResolvedValue({
        data: { success: true, data: { tenantId: 'test-tenant-id', menuItems: [] } },
      });

      const { result } = renderHook(() => useModules());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // audit is NOT in enabledModules
      expect(result.current.isModuleEnabled('audit')).toBe(false);
      
      // risk and policy ARE in enabledModules
      expect(result.current.isModuleEnabled('risk')).toBe(true);
      expect(result.current.isModuleEnabled('policy')).toBe(true);
    });

    it('should handle error and set default modules including audit', async () => {
      mockModuleApi.getEnabled.mockRejectedValue(new Error('Network error'));
      mockModuleApi.getStatus.mockRejectedValue(new Error('Network error'));
      mockModuleApi.getMenu.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useModules());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // On error, default modules should include audit
      expect(result.current.isModuleEnabled('audit')).toBe(true);
      expect(result.current.isModuleEnabled('risk')).toBe(true);
      expect(result.current.isModuleEnabled('policy')).toBe(true);
      expect(result.current.isModuleEnabled('compliance')).toBe(true);
      expect(result.current.error).toBe('Failed to load module configuration');
    });

    it('should handle empty enabledModules array gracefully', async () => {
      const envelopeResponse = {
        data: {
          success: true,
          data: {
            tenantId: 'test-tenant-id',
            enabledModules: [],
          },
        },
      };

      mockModuleApi.getEnabled.mockResolvedValue(envelopeResponse);
      mockModuleApi.getStatus.mockResolvedValue({
        data: { success: true, data: { tenantId: 'test-tenant-id', modules: [] } },
      });
      mockModuleApi.getMenu.mockResolvedValue({
        data: { success: true, data: { tenantId: 'test-tenant-id', menuItems: [] } },
      });

      const { result } = renderHook(() => useModules());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isModuleEnabled('audit')).toBe(false);
      expect(result.current.enabledModules).toHaveLength(0);
    });

    it('should handle null/undefined enabledModules gracefully', async () => {
      const envelopeResponse = {
        data: {
          success: true,
          data: {
            tenantId: 'test-tenant-id',
            // enabledModules is missing/undefined
          },
        },
      };

      mockModuleApi.getEnabled.mockResolvedValue(envelopeResponse);
      mockModuleApi.getStatus.mockResolvedValue({
        data: { success: true, data: { tenantId: 'test-tenant-id', modules: [] } },
      });
      mockModuleApi.getMenu.mockResolvedValue({
        data: { success: true, data: { tenantId: 'test-tenant-id', menuItems: [] } },
      });

      const { result } = renderHook(() => useModules());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should not crash, should return false for any module
      expect(result.current.isModuleEnabled('audit')).toBe(false);
      expect(result.current.enabledModules).toHaveLength(0);
    });
  });

  describe('isModuleEnabled function', () => {
    it('should be case-sensitive when checking module keys', async () => {
      const envelopeResponse = {
        data: {
          success: true,
          data: {
            tenantId: 'test-tenant-id',
            enabledModules: ['audit', 'RISK', 'Policy'],
          },
        },
      };

      mockModuleApi.getEnabled.mockResolvedValue(envelopeResponse);
      mockModuleApi.getStatus.mockResolvedValue({
        data: { success: true, data: { tenantId: 'test-tenant-id', modules: [] } },
      });
      mockModuleApi.getMenu.mockResolvedValue({
        data: { success: true, data: { tenantId: 'test-tenant-id', menuItems: [] } },
      });

      const { result } = renderHook(() => useModules());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Exact case match
      expect(result.current.isModuleEnabled('audit')).toBe(true);
      expect(result.current.isModuleEnabled('RISK')).toBe(true);
      expect(result.current.isModuleEnabled('Policy')).toBe(true);
      
      // Different case should not match
      expect(result.current.isModuleEnabled('Audit')).toBe(false);
      expect(result.current.isModuleEnabled('risk')).toBe(false);
      expect(result.current.isModuleEnabled('policy')).toBe(false);
    });
  });
});
