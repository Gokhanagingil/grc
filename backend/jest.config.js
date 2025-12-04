/**
 * Jest Configuration for GRC Platform Backend
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js'
  ],
  
  // Files to ignore
  testPathIgnorePatterns: [
    '/node_modules/'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'routes/**/*.js',
    'middleware/**/*.js',
    'db/**/*.js',
    'config/**/*.js',
    '!**/node_modules/**'
  ],
  
  // Coverage thresholds (can be increased over time)
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  },
  
  // Setup files
  setupFilesAfterEnv: ['./tests/setup.js'],
  
  // Timeout for tests (10 seconds)
  testTimeout: 10000,
  
  // Verbose output
  verbose: true,
  
  // Force exit after tests complete
  forceExit: true,
  
  // Detect open handles
  detectOpenHandles: true
};
