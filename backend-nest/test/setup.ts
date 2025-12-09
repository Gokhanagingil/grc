/**
 * Test Setup
 *
 * This file is run before all e2e tests to set up the test environment.
 *
 * IMPORTANT: This file loads .env.test for local development.
 * CI sets environment variables directly, so dotenv won't override them.
 * This ensures both local and CI runs work correctly.
 */
import * as crypto from 'crypto';
import * as path from 'path';
import { config } from 'dotenv';

// Load .env.test file for local development
// CI sets env vars directly via workflow env: blocks, so dotenv won't override them
// (dotenv doesn't override existing env vars by default)
// This allows local developers to use .env.test without breaking CI
config({ path: path.resolve(__dirname, '../.env.test') });

// Also load .env.test.local if it exists (for local overrides, gitignored)
config({ path: path.resolve(__dirname, '../.env.test.local') });

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
