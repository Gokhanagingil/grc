/**
 * Test Setup
 *
 * This file is run before all e2e tests to set up the test environment.
 */
import * as crypto from 'crypto';

// Set test environment variables
process.env.NODE_ENV = 'test';

// Generate a random JWT secret for tests if not already set
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
}

// Set demo admin credentials for tests
// These should match what the AuthService uses
process.env.DEMO_ADMIN_EMAIL =
  process.env.DEMO_ADMIN_EMAIL || 'admin@grc-platform.local';
process.env.DEMO_ADMIN_PASSWORD =
  process.env.DEMO_ADMIN_PASSWORD || 'TestPassword123!';

// Database configuration for tests
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_USER = process.env.DB_USER || 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
process.env.DB_NAME = process.env.DB_NAME || 'grc_platform_test';
process.env.DB_SYNC = 'true';

// Increase test timeout for e2e tests
jest.setTimeout(30000);
