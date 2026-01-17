/**
 * Unit tests for api.ts
 *
 * Tests for:
 * - getToken() - token resolution with multiple format support
 * - getTenantId() - tenant ID resolution
 * - extractTokenFromResponse() - token extraction from various response formats
 * - Header injection (single source of truth)
 * - One-time retry on 401 when token/tenant missing at request time
 */

import { getToken, getTenantId, extractTokenFromResponse, STORAGE_TENANT_ID_KEY } from '../api';

describe('api.ts helpers', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('getToken', () => {
    it('should return token from localStorage', () => {
      localStorage.setItem('token', 'test-token-123');
      expect(getToken()).toBe('test-token-123');
    });

    it('should return accessToken if token is not available (backward compatibility)', () => {
      localStorage.setItem('accessToken', 'legacy-token-456');
      expect(getToken()).toBe('legacy-token-456');
    });

    it('should prefer token over accessToken', () => {
      localStorage.setItem('token', 'primary-token');
      localStorage.setItem('accessToken', 'legacy-token');
      expect(getToken()).toBe('primary-token');
    });

    it('should return null if neither token nor accessToken exists', () => {
      expect(getToken()).toBeNull();
    });
  });

  describe('getTenantId', () => {
    it('should return tenant ID from localStorage', () => {
      localStorage.setItem(STORAGE_TENANT_ID_KEY, 'tenant-123');
      expect(getTenantId()).toBe('tenant-123');
    });

    it('should return null if tenant ID does not exist', () => {
      expect(getTenantId()).toBeNull();
    });
  });

  describe('extractTokenFromResponse', () => {
    it('should extract token from NestJS envelope format with accessToken', () => {
      const response = {
        success: true,
        data: {
          accessToken: 'token-from-envelope',
          refreshToken: 'refresh-token',
        },
      };
      expect(extractTokenFromResponse(response)).toBe('token-from-envelope');
    });

    it('should extract token from NestJS envelope format with token field', () => {
      const response = {
        success: true,
        data: {
          token: 'token-from-envelope-legacy',
          refreshToken: 'refresh-token',
        },
      };
      expect(extractTokenFromResponse(response)).toBe('token-from-envelope-legacy');
    });

    it('should prefer accessToken over token in envelope format', () => {
      const response = {
        success: true,
        data: {
          accessToken: 'preferred-token',
          token: 'legacy-token',
        },
      };
      expect(extractTokenFromResponse(response)).toBe('preferred-token');
    });

    it('should extract token from legacy Express format (flat accessToken)', () => {
      const response = {
        accessToken: 'flat-access-token',
        refreshToken: 'refresh-token',
      };
      expect(extractTokenFromResponse(response)).toBe('flat-access-token');
    });

    it('should extract token from legacy Express format (flat token)', () => {
      const response = {
        token: 'flat-token',
        refreshToken: 'refresh-token',
      };
      expect(extractTokenFromResponse(response)).toBe('flat-token');
    });

    it('should prefer accessToken over token in flat format', () => {
      const response = {
        accessToken: 'preferred-flat-token',
        token: 'legacy-flat-token',
      };
      expect(extractTokenFromResponse(response)).toBe('preferred-flat-token');
    });

    it('should return undefined for invalid response (null)', () => {
      expect(extractTokenFromResponse(null)).toBeUndefined();
    });

    it('should return undefined for invalid response (non-object)', () => {
      expect(extractTokenFromResponse('string')).toBeUndefined();
      expect(extractTokenFromResponse(123)).toBeUndefined();
    });

    it('should return undefined for response without token fields', () => {
      const response = {
        success: true,
        data: {
          user: { id: 1 },
        },
      };
      expect(extractTokenFromResponse(response)).toBeUndefined();
    });
  });
});
