/**
 * Frontend Configuration
 *
 * Centralized configuration for environment variables.
 * Provides safe defaults for local development.
 */

/**
 * Get the API base URL from environment variables.
 * 
 * If REACT_APP_API_URL is explicitly set to empty string (''), return empty string.
 * This allows relative URLs for staging/production where nginx reverse proxy handles routing.
 * 
 * Defaults to localhost:3001/api for local development.
 */
export const getApiBaseUrl = (): string => {
  // If explicitly set to empty string, use relative URL (for nginx reverse proxy)
  if (process.env.REACT_APP_API_URL === '') {
    return '';
  }
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

