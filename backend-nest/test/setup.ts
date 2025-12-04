/**
 * E2E Test Setup
 * 
 * This file is run before each test file.
 * It sets up environment variables and any global test configuration.
 * 
 * Note: JWT_SECRET and other sensitive values should be provided via
 * environment variables in CI. The defaults here are for local development only.
 */

// Set test environment variables (use existing env vars if provided)
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PORT = process.env.PORT || '3002';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// JWT_SECRET must be provided via environment variable
// In CI, this is set in the workflow file
// For local development, set it in your shell or .env file
if (!process.env.JWT_SECRET) {
  // Generate a random test secret for local development
  process.env.JWT_SECRET = require('crypto').randomBytes(32).toString('hex');
}

// Database configuration for tests
// For CI without PostgreSQL, tests will be skipped gracefully
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_USER = process.env.DB_USER || 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
process.env.DB_NAME = process.env.DB_NAME || 'grc_platform_test';
process.env.DB_SYNC = process.env.DB_SYNC || 'true';

// CORS
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3002';

// Increase test timeout for e2e tests
jest.setTimeout(30000);
