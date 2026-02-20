/**
 * User API Configuration
 * 
 * This module provides configuration for switching between Express and NestJS
 * backends for User Management operations. It supports a feature-flag based
 * approach to enable gradual migration.
 * 
 * Environment Variables:
 * - REACT_APP_EXPRESS_API_URL: Base URL for Express backend (default: http://localhost:3001/api)
 * - REACT_APP_NEST_API_URL: Base URL for NestJS backend (default: http://localhost:3002)
 * - REACT_APP_USER_API_MODE: API mode - "express" or "nest" (default: "express")
 */

export type UserApiMode = 'express' | 'nest';

/**
 * Default configuration values
 */
const DEFAULTS = {
  EXPRESS_API_URL: 'http://localhost:3001/api',
  NEST_API_URL: 'http://localhost:3002',
  USER_API_MODE: 'nest' as UserApiMode,
} as const;

/**
 * Get the current User API mode from environment variables.
 * Defaults to "nest" as the primary backend for user management.
 * 
 * @returns The current API mode ("express" or "nest")
 */
export function getUserApiMode(): UserApiMode {
  const mode = process.env.REACT_APP_USER_API_MODE?.toLowerCase();
  
  if (mode === 'express') {
    return 'express';
  }
  
  // Default to nest as the primary backend
  return 'nest';
}

/**
 * Get the Express API base URL from environment variables.
 * 
 * @returns The Express API base URL
 */
export function getExpressApiUrl(): string {
  return process.env.REACT_APP_EXPRESS_API_URL || 
         process.env.REACT_APP_API_URL || 
         DEFAULTS.EXPRESS_API_URL;
}

/**
 * Get the NestJS API base URL from environment variables.
 * Falls back to REACT_APP_API_URL (without /api suffix) for production compatibility.
 * 
 * If REACT_APP_API_URL is explicitly set to empty string (''), return empty string
 * to use relative URLs (for nginx reverse proxy in staging/production).
 * 
 * @returns The NestJS API base URL
 */
export function getNestApiUrl(): string {
  // First check for explicit NestJS URL
  if (process.env.REACT_APP_NEST_API_URL) {
    return process.env.REACT_APP_NEST_API_URL;
  }
  
  // If REACT_APP_API_URL is explicitly set to empty string, use relative URL
  // This is for staging/production where nginx reverse proxy handles routing
  if (process.env.REACT_APP_API_URL === '') {
    return '';
  }
  
  // Fall back to main API URL (remove /api suffix if present) for production
  const mainApiUrl = process.env.REACT_APP_API_URL;
  if (mainApiUrl) {
    return mainApiUrl.replace(/\/api\/?$/, '');
  }
  
  return DEFAULTS.NEST_API_URL;
}

/**
 * Get the appropriate User API base URL based on the current mode.
 * 
 * @param mode Optional mode override. If not provided, uses getUserApiMode()
 * @returns The base URL for the User API
 */
export function getUserApiBaseUrl(mode?: UserApiMode): string {
  const currentMode = mode ?? getUserApiMode();
  
  if (currentMode === 'nest') {
    return getNestApiUrl();
  }
  
  return getExpressApiUrl();
}

/**
 * Get the users endpoint path based on the API mode.
 * Express uses /users (relative to /api base)
 * NestJS uses /users (relative to root)
 * 
 * @param mode Optional mode override
 * @returns The users endpoint path
 */
export function getUsersEndpointPath(mode?: UserApiMode): string {
  // Both backends use /users path, but the base URL differs
  return '/users';
}

/**
 * Check if the current mode is NestJS
 * 
 * @returns true if using NestJS backend
 */
export function isNestMode(): boolean {
  return getUserApiMode() === 'nest';
}

/**
 * Check if the current mode is Express
 * 
 * @returns true if using Express backend
 */
export function isExpressMode(): boolean {
  return getUserApiMode() === 'express';
}

/**
 * Configuration object for easy access to all config values
 */
export const userApiConfig = {
  getMode: getUserApiMode,
  getBaseUrl: getUserApiBaseUrl,
  getExpressUrl: getExpressApiUrl,
  getNestUrl: getNestApiUrl,
  getEndpointPath: getUsersEndpointPath,
  isNestMode,
  isExpressMode,
  defaults: DEFAULTS,
} as const;

export default userApiConfig;
