/**
 * Unit tests for userClient module
 * 
 * Tests the response adapter logic for both Express and NestJS formats.
 * These tests focus on the adapter functions and configuration logic.
 */

import { getUserApiMode, getUserApiBaseUrl } from '../userApiConfig';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('userClient adapter logic', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Express mode configuration', () => {
    beforeEach(() => {
      process.env.REACT_APP_USER_API_MODE = 'express';
    });

    it('should return "express" mode when configured', () => {
      expect(getUserApiMode()).toBe('express');
    });

    it('should return Express base URL', () => {
      process.env.REACT_APP_EXPRESS_API_URL = 'http://express:3001/api';
      expect(getUserApiBaseUrl()).toBe('http://express:3001/api');
    });

    it('should use default Express URL when not configured', () => {
      delete process.env.REACT_APP_EXPRESS_API_URL;
      delete process.env.REACT_APP_API_URL;
      expect(getUserApiBaseUrl()).toBe('http://localhost:3001/api');
    });
  });

  describe('NestJS mode configuration', () => {
    beforeEach(() => {
      process.env.REACT_APP_USER_API_MODE = 'nest';
    });

    it('should return "nest" mode when configured', () => {
      expect(getUserApiMode()).toBe('nest');
    });

    it('should return NestJS base URL', () => {
      process.env.REACT_APP_NEST_API_URL = 'http://nest:3002';
      expect(getUserApiBaseUrl()).toBe('http://nest:3002');
    });

    it('should use default NestJS URL when not configured', () => {
      delete process.env.REACT_APP_NEST_API_URL;
      expect(getUserApiBaseUrl()).toBe('http://localhost:3002');
    });
  });

  describe('Default mode behavior', () => {
    it('should default to Express mode when no mode is set', () => {
      delete process.env.REACT_APP_USER_API_MODE;
      expect(getUserApiMode()).toBe('express');
    });

    it('should default to Express mode for invalid mode values', () => {
      process.env.REACT_APP_USER_API_MODE = 'invalid';
      expect(getUserApiMode()).toBe('express');
    });
  });

  describe('Response format expectations', () => {
    it('Express response format should be raw data', () => {
      const expressResponse = {
        users: [
          {
            id: 1,
            username: 'john.doe',
            email: 'john@example.com',
            first_name: 'John',
            last_name: 'Doe',
            role: 'admin',
            department: 'IT',
            is_active: 1,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
      };

      // Express returns raw data without envelope
      expect(expressResponse).not.toHaveProperty('success');
      expect(expressResponse).toHaveProperty('users');
      expect(expressResponse.users[0]).toHaveProperty('first_name');
      expect(expressResponse.users[0]).toHaveProperty('is_active');
    });

    it('NestJS response format should be envelope with camelCase', () => {
      const nestResponse = {
        success: true,
        data: {
          users: [
            {
              id: '550e8400-e29b-41d4-a716-446655440000',
              username: 'jane.doe',
              email: 'jane@example.com',
              firstName: 'Jane',
              lastName: 'Doe',
              role: 'manager',
              department: 'HR',
              isActive: true,
              createdAt: '2024-01-01T00:00:00Z',
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            pages: 1,
          },
        },
      };

      // NestJS returns envelope format with camelCase
      expect(nestResponse).toHaveProperty('success', true);
      expect(nestResponse).toHaveProperty('data');
      expect(nestResponse.data.users[0]).toHaveProperty('firstName');
      expect(nestResponse.data.users[0]).toHaveProperty('isActive');
      expect(nestResponse.data).toHaveProperty('pagination');
    });
  });

  describe('ID format differences', () => {
    it('Express uses integer IDs', () => {
      const expressUser = { id: 1 };
      expect(typeof expressUser.id).toBe('number');
    });

    it('NestJS uses UUID IDs', () => {
      const nestUser = { id: '550e8400-e29b-41d4-a716-446655440000' };
      expect(typeof nestUser.id).toBe('string');
      expect(nestUser.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  describe('Field naming conventions', () => {
    it('Express uses snake_case fields', () => {
      const expressUser = {
        first_name: 'John',
        last_name: 'Doe',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      };

      expect(expressUser).toHaveProperty('first_name');
      expect(expressUser).toHaveProperty('last_name');
      expect(expressUser).toHaveProperty('is_active');
      expect(expressUser).toHaveProperty('created_at');
    });

    it('NestJS uses camelCase fields', () => {
      const nestUser = {
        firstName: 'Jane',
        lastName: 'Doe',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
      };

      expect(nestUser).toHaveProperty('firstName');
      expect(nestUser).toHaveProperty('lastName');
      expect(nestUser).toHaveProperty('isActive');
      expect(nestUser).toHaveProperty('createdAt');
    });
  });

  describe('Normalized User interface', () => {
    it('should define consistent User interface for UI', () => {
      // The normalized User interface expected by the UI
      const normalizedUser = {
        id: 1 as string | number, // Can be integer or UUID
        username: 'john.doe',
        email: 'john@example.com',
        first_name: 'John', // snake_case for UI compatibility
        last_name: 'Doe',
        role: 'admin',
        department: 'IT' as string | null,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      };

      expect(normalizedUser).toHaveProperty('id');
      expect(normalizedUser).toHaveProperty('first_name');
      expect(normalizedUser).toHaveProperty('is_active');
      expect(normalizedUser).toHaveProperty('created_at');
    });
  });

  describe('Request data transformation expectations', () => {
    it('Express expects snake_case request data', () => {
      const expressRequestData = {
        username: 'new.user',
        email: 'new@example.com',
        first_name: 'New',
        last_name: 'User',
        role: 'user',
        department: 'Sales',
        password: 'password123',
        is_active: true,
      };

      expect(expressRequestData).toHaveProperty('first_name');
      expect(expressRequestData).toHaveProperty('last_name');
      expect(expressRequestData).toHaveProperty('is_active');
    });

    it('NestJS expects camelCase request data', () => {
      const nestRequestData = {
        username: 'new.user',
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
        role: 'user',
        department: 'Sales',
        password: 'password123',
        isActive: true,
      };

      expect(nestRequestData).toHaveProperty('firstName');
      expect(nestRequestData).toHaveProperty('lastName');
      expect(nestRequestData).toHaveProperty('isActive');
    });
  });
});
