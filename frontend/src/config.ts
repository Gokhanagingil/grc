/**
 * Frontend Configuration
 *
 * Centralized configuration for environment variables.
 * Provides safe defaults for local development.
 */

/**
 * Get the API base URL from environment variables.
 * Defaults to localhost:3001/api for local development.
 */
export const getApiBaseUrl = (): string => {
  return (
    process.env.REACT_APP_API_URL || 'http://localhost:3001/api'
  );
};

/**
 * Configuration object for easy access
 */
export const config = {
  apiBaseUrl: getApiBaseUrl(),
} as const;

