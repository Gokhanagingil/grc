/**
 * Unit tests for useUiPolicy hook
 * 
 * Tests safety hardening against undefined/partial actions to prevent crashes:
 * - "Cannot read properties of undefined (reading 'hiddenFields')"
 * - "Cannot read properties of undefined (reading 'readonlyFields')"
 * 
 * Regression tests for:
 * 1. Initial render before fetch completes (actions undefined)
 * 2. Failed API fetch (actions stays at defaults)
 * 3. Unexpected response shape (partial actions object)
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useUiPolicy } from '../useUiPolicy';
import { uiPolicyApi } from '../../services/platformApi';

// Mock the platformApi module
jest.mock('../../services/platformApi', () => ({
  uiPolicyApi: {
    getForTable: jest.fn(),
    evaluate: jest.fn(),
  },
}));

// Mock the AuthContext
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 'test-user', role: 'admin' },
    token: 'test-token',
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUiPolicyApi = uiPolicyApi as any;

describe('useUiPolicy hook - Safety Hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Regression: Cannot read properties of undefined (reading hiddenFields)', () => {
    it('should not throw when actions is undefined during initial render', async () => {
      // Simulate slow API response - hook should not crash before response arrives
      mockUiPolicyApi.getForTable.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          data: { policies: [] }
        }), 100))
      );

      // This should NOT throw "Cannot read properties of undefined (reading 'hiddenFields')"
      const { result } = renderHook(() => useUiPolicy('audits'));

      // During loading, all field checks should return safe defaults
      expect(result.current.isLoading).toBe(true);
      expect(() => result.current.isFieldHidden('anyField')).not.toThrow();
      expect(() => result.current.isFieldReadonly('anyField')).not.toThrow();
      expect(() => result.current.isFieldMandatory('anyField')).not.toThrow();
      expect(() => result.current.isFieldDisabled('anyField')).not.toThrow();

      // All should return false with default empty arrays
      expect(result.current.isFieldHidden('anyField')).toBe(false);
      expect(result.current.isFieldReadonly('anyField')).toBe(false);
      expect(result.current.isFieldMandatory('anyField')).toBe(false);
      expect(result.current.isFieldDisabled('anyField')).toBe(false);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should not throw when API call fails and returns error', async () => {
      // Simulate API failure
      mockUiPolicyApi.getForTable.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useUiPolicy('audits'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have error but NOT crash
      expect(result.current.error).toBe('Failed to load UI policies');
      
      // Field checks should still work with defaults
      expect(() => result.current.isFieldHidden('anyField')).not.toThrow();
      expect(() => result.current.isFieldReadonly('anyField')).not.toThrow();
      expect(result.current.isFieldHidden('anyField')).toBe(false);
      expect(result.current.isFieldReadonly('anyField')).toBe(false);
    });

    it('should not throw when evaluate API returns undefined actions', async () => {
      mockUiPolicyApi.getForTable.mockResolvedValue({
        data: { policies: [{ id: 1, name: 'test' }] }
      });
      
      // Simulate API returning undefined actions
      mockUiPolicyApi.evaluate.mockResolvedValue({
        data: { tableName: 'audits', actions: undefined }
      });

      const { result } = renderHook(() => useUiPolicy('audits', { status: 'open' }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should NOT crash when accessing field checks
      expect(() => result.current.isFieldHidden('status')).not.toThrow();
      expect(() => result.current.isFieldReadonly('status')).not.toThrow();
      expect(result.current.isFieldHidden('status')).toBe(false);
      expect(result.current.isFieldReadonly('status')).toBe(false);
    });

    it('should not throw when evaluate API returns null actions', async () => {
      mockUiPolicyApi.getForTable.mockResolvedValue({
        data: { policies: [{ id: 1, name: 'test' }] }
      });
      
      // Simulate API returning null actions
      mockUiPolicyApi.evaluate.mockResolvedValue({
        data: { tableName: 'audits', actions: null }
      });

      const { result } = renderHook(() => useUiPolicy('audits', { status: 'open' }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should NOT crash
      expect(() => result.current.isFieldHidden('status')).not.toThrow();
      expect(() => result.current.isFieldReadonly('status')).not.toThrow();
    });
  });

  describe('Regression: Cannot read properties of undefined (reading readonlyFields)', () => {
    it('should not throw when actions object is missing readonlyFields', async () => {
      mockUiPolicyApi.getForTable.mockResolvedValue({
        data: { policies: [{ id: 1, name: 'test' }] }
      });
      
      // Simulate API returning partial actions (missing readonlyFields)
      mockUiPolicyApi.evaluate.mockResolvedValue({
        data: { 
          tableName: 'audits', 
          actions: {
            hiddenFields: ['secret'],
            // readonlyFields is missing!
            mandatoryFields: ['name'],
          }
        }
      });

      const { result } = renderHook(() => useUiPolicy('audits', { status: 'open' }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should NOT crash when accessing readonlyFields
      expect(() => result.current.isFieldReadonly('status')).not.toThrow();
      expect(result.current.isFieldReadonly('status')).toBe(false);
      
      // hiddenFields should still work
      expect(result.current.isFieldHidden('secret')).toBe(true);
      expect(result.current.isFieldHidden('other')).toBe(false);
    });
  });

  describe('Partial actions object handling', () => {
    it('should handle actions with only hiddenFields defined', async () => {
      mockUiPolicyApi.getForTable.mockResolvedValue({
        data: { policies: [{ id: 1, name: 'test' }] }
      });
      
      mockUiPolicyApi.evaluate.mockResolvedValue({
        data: { 
          tableName: 'audits', 
          actions: {
            hiddenFields: ['secretField'],
            // All other fields are missing
          }
        }
      });

      const { result } = renderHook(() => useUiPolicy('audits', { status: 'open' }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // hiddenFields should work
      expect(result.current.isFieldHidden('secretField')).toBe(true);
      
      // Other field checks should return defaults (false)
      expect(result.current.isFieldReadonly('anyField')).toBe(false);
      expect(result.current.isFieldMandatory('anyField')).toBe(false);
      expect(result.current.isFieldDisabled('anyField')).toBe(false);
    });

    it('should handle empty actions object', async () => {
      mockUiPolicyApi.getForTable.mockResolvedValue({
        data: { policies: [{ id: 1, name: 'test' }] }
      });
      
      mockUiPolicyApi.evaluate.mockResolvedValue({
        data: { 
          tableName: 'audits', 
          actions: {}  // Empty object
        }
      });

      const { result } = renderHook(() => useUiPolicy('audits', { status: 'open' }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // All field checks should return false with empty defaults
      expect(result.current.isFieldHidden('anyField')).toBe(false);
      expect(result.current.isFieldReadonly('anyField')).toBe(false);
      expect(result.current.isFieldMandatory('anyField')).toBe(false);
      expect(result.current.isFieldDisabled('anyField')).toBe(false);
    });
  });

  describe('Normal operation with complete actions', () => {
    it('should correctly identify hidden fields', async () => {
      mockUiPolicyApi.getForTable.mockResolvedValue({
        data: { policies: [{ id: 1, name: 'test' }] }
      });
      
      mockUiPolicyApi.evaluate.mockResolvedValue({
        data: { 
          tableName: 'audits', 
          actions: {
            hiddenFields: ['internalNotes', 'secretKey'],
            shownFields: [],
            readonlyFields: [],
            editableFields: [],
            mandatoryFields: [],
            optionalFields: [],
            disabledFields: [],
          }
        }
      });

      const { result } = renderHook(() => useUiPolicy('audits', { status: 'open' }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isFieldHidden('internalNotes')).toBe(true);
      expect(result.current.isFieldHidden('secretKey')).toBe(true);
      expect(result.current.isFieldHidden('publicField')).toBe(false);
    });

    it('should correctly identify readonly fields', async () => {
      mockUiPolicyApi.getForTable.mockResolvedValue({
        data: { policies: [{ id: 1, name: 'test' }] }
      });
      
      mockUiPolicyApi.evaluate.mockResolvedValue({
        data: { 
          tableName: 'audits', 
          actions: {
            hiddenFields: [],
            shownFields: [],
            readonlyFields: ['createdAt', 'id'],
            editableFields: [],
            mandatoryFields: [],
            optionalFields: [],
            disabledFields: [],
          }
        }
      });

      const { result } = renderHook(() => useUiPolicy('audits', { status: 'open' }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isFieldReadonly('createdAt')).toBe(true);
      expect(result.current.isFieldReadonly('id')).toBe(true);
      expect(result.current.isFieldReadonly('name')).toBe(false);
    });

    it('should respect shownFields override for hidden fields', async () => {
      mockUiPolicyApi.getForTable.mockResolvedValue({
        data: { policies: [{ id: 1, name: 'test' }] }
      });
      
      mockUiPolicyApi.evaluate.mockResolvedValue({
        data: { 
          tableName: 'audits', 
          actions: {
            hiddenFields: ['conditionalField'],
            shownFields: ['conditionalField'],  // Override: show it
            readonlyFields: [],
            editableFields: [],
            mandatoryFields: [],
            optionalFields: [],
            disabledFields: [],
          }
        }
      });

      const { result } = renderHook(() => useUiPolicy('audits', { status: 'open' }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // shownFields should override hiddenFields
      expect(result.current.isFieldHidden('conditionalField')).toBe(false);
    });

    it('should respect editableFields override for readonly fields', async () => {
      mockUiPolicyApi.getForTable.mockResolvedValue({
        data: { policies: [{ id: 1, name: 'test' }] }
      });
      
      mockUiPolicyApi.evaluate.mockResolvedValue({
        data: { 
          tableName: 'audits', 
          actions: {
            hiddenFields: [],
            shownFields: [],
            readonlyFields: ['status'],
            editableFields: ['status'],  // Override: make it editable
            mandatoryFields: [],
            optionalFields: [],
            disabledFields: [],
          }
        }
      });

      const { result } = renderHook(() => useUiPolicy('audits', { status: 'open' }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // editableFields should override readonlyFields
      expect(result.current.isFieldReadonly('status')).toBe(false);
    });
  });

  describe('evaluatePolicies error handling', () => {
    it('should keep current actions when evaluate API fails', async () => {
      mockUiPolicyApi.getForTable.mockResolvedValue({
        data: { policies: [{ id: 1, name: 'test' }] }
      });
      
      // First evaluation succeeds
      mockUiPolicyApi.evaluate.mockResolvedValueOnce({
        data: { 
          tableName: 'audits', 
          actions: {
            hiddenFields: ['secretField'],
            shownFields: [],
            readonlyFields: [],
            editableFields: [],
            mandatoryFields: [],
            optionalFields: [],
            disabledFields: [],
          }
        }
      });

      const { result } = renderHook(() => useUiPolicy('audits', { status: 'open' }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isFieldHidden('secretField')).toBe(true);

      // Second evaluation fails
      mockUiPolicyApi.evaluate.mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        await result.current.evaluatePolicies({ status: 'closed' });
      });

      // Should keep previous actions, not crash
      expect(result.current.isFieldHidden('secretField')).toBe(true);
    });
  });

  describe('actions object returned by hook', () => {
    it('should return safe actions object even with partial API response', async () => {
      mockUiPolicyApi.getForTable.mockResolvedValue({
        data: { policies: [] }
      });

      const { result } = renderHook(() => useUiPolicy('audits'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // The actions object should have all fields defined as arrays
      expect(result.current.actions).toBeDefined();
      expect(Array.isArray(result.current.actions.hiddenFields)).toBe(true);
      expect(Array.isArray(result.current.actions.shownFields)).toBe(true);
      expect(Array.isArray(result.current.actions.readonlyFields)).toBe(true);
      expect(Array.isArray(result.current.actions.editableFields)).toBe(true);
      expect(Array.isArray(result.current.actions.mandatoryFields)).toBe(true);
      expect(Array.isArray(result.current.actions.optionalFields)).toBe(true);
      expect(Array.isArray(result.current.actions.disabledFields)).toBe(true);
    });
  });
});
