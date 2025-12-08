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
  USER_API_MODE: 'express' as UserApiMode,
} as const;

/**
 * Get the current User API mode from environment variables.
 * Defaults to "express" to maintain backward compatibility.
 * 
 * @returns The current API mode ("express" or "nest")
 */
export function getUserApiMode(): UserApiMode {
  const mode = process.env.REACT_APP_USER_API_MODE?.toLowerCase();
  
  if (mode === 'nest') {
    return 'nest';
  }
  
  // Default to express for backward compatibility
  return 'express';
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
 * 
 * @returns The NestJS API base URL
 */
export function getNestApiUrl(): string {
  return process.env.REACT_APP_NEST_API_URL || DEFAULTS.NEST_API_URL;
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
