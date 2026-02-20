/**
 * Unit tests for userApiConfig module
 */

import {
  getUserApiMode,
  getExpressApiUrl,
  getNestApiUrl,
  getUserApiBaseUrl,
  getUsersEndpointPath,
  isNestMode,
  isExpressMode,
  userApiConfig,
} from '../userApiConfig';

describe('userApiConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getUserApiMode', () => {
    it('should return "nest" by default when no env var is set', () => {
      delete process.env.REACT_APP_USER_API_MODE;
      expect(getUserApiMode()).toBe('nest');
    });

    it('should return "express" when REACT_APP_USER_API_MODE is "express"', () => {
      process.env.REACT_APP_USER_API_MODE = 'express';
      expect(getUserApiMode()).toBe('express');
    });

    it('should return "nest" when REACT_APP_USER_API_MODE is "nest"', () => {
      process.env.REACT_APP_USER_API_MODE = 'nest';
      expect(getUserApiMode()).toBe('nest');
    });

    it('should return "nest" when REACT_APP_USER_API_MODE is "NEST" (case insensitive)', () => {
      process.env.REACT_APP_USER_API_MODE = 'NEST';
      expect(getUserApiMode()).toBe('nest');
    });

    it('should return "nest" for invalid mode values', () => {
      process.env.REACT_APP_USER_API_MODE = 'invalid';
      expect(getUserApiMode()).toBe('nest');
    });
  });

  describe('getExpressApiUrl', () => {
    it('should return default URL when no env vars are set', () => {
      delete process.env.REACT_APP_EXPRESS_API_URL;
      delete process.env.REACT_APP_API_URL;
      expect(getExpressApiUrl()).toBe('http://localhost:3001/api');
    });

    it('should return REACT_APP_EXPRESS_API_URL when set', () => {
      process.env.REACT_APP_EXPRESS_API_URL = 'http://custom-express:3001/api';
      expect(getExpressApiUrl()).toBe('http://custom-express:3001/api');
    });

    it('should fall back to REACT_APP_API_URL when EXPRESS_API_URL is not set', () => {
      delete process.env.REACT_APP_EXPRESS_API_URL;
      process.env.REACT_APP_API_URL = 'http://fallback:3001/api';
      expect(getExpressApiUrl()).toBe('http://fallback:3001/api');
    });

    it('should prefer REACT_APP_EXPRESS_API_URL over REACT_APP_API_URL', () => {
      process.env.REACT_APP_EXPRESS_API_URL = 'http://express-specific:3001/api';
      process.env.REACT_APP_API_URL = 'http://fallback:3001/api';
      expect(getExpressApiUrl()).toBe('http://express-specific:3001/api');
    });
  });

  describe('getNestApiUrl', () => {
    it('should return default URL when no env var is set', () => {
      delete process.env.REACT_APP_NEST_API_URL;
      delete process.env.REACT_APP_API_URL;
      expect(getNestApiUrl()).toBe('http://localhost:3002');
    });

    it('should return REACT_APP_NEST_API_URL when set', () => {
      process.env.REACT_APP_NEST_API_URL = 'http://custom-nest:3002';
      expect(getNestApiUrl()).toBe('http://custom-nest:3002');
    });

    it('should return empty string when REACT_APP_API_URL is empty (for nginx proxy)', () => {
      delete process.env.REACT_APP_NEST_API_URL;
      process.env.REACT_APP_API_URL = '';
      expect(getNestApiUrl()).toBe('');
    });

    it('should fall back to REACT_APP_API_URL without /api suffix', () => {
      delete process.env.REACT_APP_NEST_API_URL;
      process.env.REACT_APP_API_URL = 'http://fallback:3001/api';
      expect(getNestApiUrl()).toBe('http://fallback:3001');
    });
  });

  describe('getUserApiBaseUrl', () => {
    it('should return Express URL when mode is "express"', () => {
      process.env.REACT_APP_USER_API_MODE = 'express';
      process.env.REACT_APP_EXPRESS_API_URL = 'http://express:3001/api';
      expect(getUserApiBaseUrl()).toBe('http://express:3001/api');
    });

    it('should return NestJS URL when mode is "nest"', () => {
      process.env.REACT_APP_USER_API_MODE = 'nest';
      process.env.REACT_APP_NEST_API_URL = 'http://nest:3002';
      expect(getUserApiBaseUrl()).toBe('http://nest:3002');
    });

    it('should accept mode override parameter', () => {
      process.env.REACT_APP_USER_API_MODE = 'express';
      process.env.REACT_APP_NEST_API_URL = 'http://nest:3002';
      expect(getUserApiBaseUrl('nest')).toBe('http://nest:3002');
    });

    it('should use Express URL when mode override is "express"', () => {
      process.env.REACT_APP_USER_API_MODE = 'nest';
      process.env.REACT_APP_EXPRESS_API_URL = 'http://express:3001/api';
      expect(getUserApiBaseUrl('express')).toBe('http://express:3001/api');
    });
  });

  describe('getUsersEndpointPath', () => {
    it('should return "/users" for express mode', () => {
      expect(getUsersEndpointPath('express')).toBe('/users');
    });

    it('should return "/users" for nest mode', () => {
      expect(getUsersEndpointPath('nest')).toBe('/users');
    });

    it('should return "/users" when no mode is specified', () => {
      expect(getUsersEndpointPath()).toBe('/users');
    });
  });

  describe('isNestMode', () => {
    it('should return true when mode is "nest"', () => {
      process.env.REACT_APP_USER_API_MODE = 'nest';
      expect(isNestMode()).toBe(true);
    });

    it('should return false when mode is "express"', () => {
      process.env.REACT_APP_USER_API_MODE = 'express';
      expect(isNestMode()).toBe(false);
    });

    it('should return true by default', () => {
      delete process.env.REACT_APP_USER_API_MODE;
      expect(isNestMode()).toBe(true);
    });
  });

  describe('isExpressMode', () => {
    it('should return true when mode is "express"', () => {
      process.env.REACT_APP_USER_API_MODE = 'express';
      expect(isExpressMode()).toBe(true);
    });

    it('should return false when mode is "nest"', () => {
      process.env.REACT_APP_USER_API_MODE = 'nest';
      expect(isExpressMode()).toBe(false);
    });

    it('should return false by default', () => {
      delete process.env.REACT_APP_USER_API_MODE;
      expect(isExpressMode()).toBe(false);
    });
  });

  describe('userApiConfig object', () => {
    it('should expose all configuration functions', () => {
      expect(userApiConfig.getMode).toBe(getUserApiMode);
      expect(userApiConfig.getBaseUrl).toBe(getUserApiBaseUrl);
      expect(userApiConfig.getExpressUrl).toBe(getExpressApiUrl);
      expect(userApiConfig.getNestUrl).toBe(getNestApiUrl);
      expect(userApiConfig.getEndpointPath).toBe(getUsersEndpointPath);
      expect(userApiConfig.isNestMode).toBe(isNestMode);
      expect(userApiConfig.isExpressMode).toBe(isExpressMode);
    });

    it('should expose default values', () => {
      expect(userApiConfig.defaults.EXPRESS_API_URL).toBe('http://localhost:3001/api');
      expect(userApiConfig.defaults.NEST_API_URL).toBe('http://localhost:3002');
      expect(userApiConfig.defaults.USER_API_MODE).toBe('nest');
    });
  });
});
