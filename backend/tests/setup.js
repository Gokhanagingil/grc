/**
 * Jest Test Setup
 * 
 * This file runs before each test file.
 * It sets up the test environment and provides common utilities.
 */

// Set test environment BEFORE any imports
process.env.NODE_ENV = 'test';

// Use SQLite for tests (simpler, no external dependencies)
process.env.DB_CLIENT = 'sqlite';
process.env.DB_PATH = ':memory:';

// Set a test JWT key (must be 32+ chars and not contain insecure patterns)
process.env.JWT_SECRET = 'xK9mN2pQ4rS6tU8vW0yA1bC3dE5fG7hJ9kL1mN3oP5qR7sT9uV1wX3yZ5a7b9c0d';
process.env.JWT_EXPIRES_IN = '1h';

// Disable rate limiting for most tests (can be enabled per-test)
process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.RATE_LIMIT_MAX = '1000';

// CORS origins for testing
process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:3001';

// Increase Jest timeout for slower operations
jest.setTimeout(15000);

// Global test utilities
global.testUtils = {
  /**
   * Generate a random string for unique test data
   */
  randomString: (length = 8) => {
    return Math.random().toString(36).substring(2, 2 + length);
  },
  
  /**
   * Create a test user payload
   */
  createUserPayload: (overrides = {}) => ({
    username: `testuser_${global.testUtils.randomString()}`,
    email: `test_${global.testUtils.randomString()}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
    department: 'Testing',
    ...overrides
  }),
  
  /**
   * Initialize app for testing
   * Returns the app instance after database is initialized
   */
  initApp: async () => {
    // Clear module cache to get fresh instances
    jest.resetModules();
    
    // Re-set environment variables after reset
    process.env.NODE_ENV = 'test';
    process.env.DB_CLIENT = 'sqlite';
    process.env.DB_PATH = ':memory:';
    process.env.JWT_SECRET = 'xK9mN2pQ4rS6tU8vW0yA1bC3dE5fG7hJ9kL1mN3oP5qR7sT9uV1wX3yZ5a7b9c0d';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.AUTH_RATE_LIMIT_MAX = '1000';
    process.env.RATE_LIMIT_MAX = '1000';
    process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:3001';
    
    // Re-import after resetting modules
    const dbConnection = require('../database/connection');
    
    // Initialize database (creates tables for SQLite)
    await dbConnection.init();
    
    // Import app after db is initialized
    const app = require('../server');
    
    return { app, dbConnection };
  }
};

// Clean up after all tests
afterAll(async () => {
  // Give time for any pending operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
});
