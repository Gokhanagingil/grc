/**
 * Configuration module with environment variable validation
 * Fails fast if critical configuration is missing or invalid
 */

require('dotenv').config();

const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Validates that a required environment variable is set
 * @param {string} name - Environment variable name
 * @param {string} value - Environment variable value
 * @throws {Error} If the value is not set
 */
function requireEnv(name, value) {
  if (!value || value.trim() === '') {
    throw new Error(`FATAL: Required environment variable ${name} is not set. Please check your .env file.`);
  }
  return value;
}

/**
 * Validates JWT_SECRET meets minimum security requirements
 * @param {string} secret - The JWT secret
 * @throws {Error} If the secret is too weak
 */
function validateJwtSecret(secret) {
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET is not set. Please set a secure secret in your .env file.');
  }
  
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(`FATAL: JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long. Current length: ${secret.length}`);
  }
  
  // Check for obviously insecure default values
  const insecurePatterns = [
    'your-super-secret',
    'change-this',
    'secret',
    'password',
    'jwt-secret',
    '123456',
    'abcdef'
  ];
  
  const lowerSecret = secret.toLowerCase();
  for (const pattern of insecurePatterns) {
    if (lowerSecret.includes(pattern)) {
      throw new Error(`FATAL: JWT_SECRET appears to contain an insecure default value. Please generate a cryptographically secure secret.`);
    }
  }
  
  return secret;
}

/**
 * Parses CORS origins from environment variable
 * @param {string} originsStr - Comma-separated list of origins
 * @param {string} nodeEnv - Current NODE_ENV
 * @returns {string|string[]} - Parsed origins
 */
function parseCorsOrigins(originsStr, nodeEnv) {
  // Default safe origins for development
  const defaultOrigins = ['http://localhost:3000', 'http://localhost:3001'];
  
  if (!originsStr || originsStr.trim() === '') {
    if (nodeEnv === 'production') {
      console.warn('WARNING: CORS_ORIGINS not set in production. Using restrictive default.');
      return []; // No origins allowed by default in production
    }
    return defaultOrigins;
  }
  
  // Parse comma-separated origins
  const origins = originsStr.split(',').map(origin => origin.trim()).filter(Boolean);
  
  // Validate no wildcard in production
  if (nodeEnv === 'production' && origins.includes('*')) {
    throw new Error('FATAL: CORS_ORIGINS cannot be "*" in production. Please specify allowed origins.');
  }
  
  return origins;
}

/**
 * Parses rate limit configuration
 * @param {string} windowMs - Window in milliseconds
 * @param {string} maxRequests - Maximum requests per window
 * @returns {Object} - Rate limit configuration
 */
function parseRateLimitConfig(windowMs, maxRequests) {
  return {
    windowMs: parseInt(windowMs, 10) || 15 * 60 * 1000, // Default: 15 minutes
    max: parseInt(maxRequests, 10) || 100 // Default: 100 requests per window
  };
}

/**
 * Parses auth-specific rate limit configuration (stricter defaults)
 * @param {string} windowMs - Window in milliseconds
 * @param {string} maxRequests - Maximum requests per window
 * @returns {Object} - Rate limit configuration
 */
function parseAuthRateLimitConfig(windowMs, maxRequests) {
  return {
    windowMs: parseInt(windowMs, 10) || 15 * 60 * 1000, // Default: 15 minutes
    max: parseInt(maxRequests, 10) || 5 // Default: 5 attempts per window (stricter for auth)
  };
}

// Build and validate configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

// Validate JWT_SECRET in all environments
let jwtSecret;
try {
  jwtSecret = validateJwtSecret(process.env.JWT_SECRET);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const config = {
  // Environment
  nodeEnv: NODE_ENV,
  isProduction,
  isDevelopment: NODE_ENV === 'development',
  
  // Server
  port: parseInt(process.env.PORT, 10) || 3001,
  
  // Security
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  
  // CORS
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS, NODE_ENV),
  
  // Rate Limiting
  rateLimit: {
    global: parseRateLimitConfig(
      process.env.RATE_LIMIT_WINDOW_MS,
      process.env.RATE_LIMIT_MAX
    ),
    auth: parseAuthRateLimitConfig(
      process.env.AUTH_RATE_LIMIT_WINDOW_MS,
      process.env.AUTH_RATE_LIMIT_MAX
    )
  },
  
  // Database
  dbPath: process.env.DB_PATH || './database/grc.db'
};

// Log configuration on startup (without sensitive values)
console.log('Configuration loaded:');
console.log(`  Environment: ${config.nodeEnv}`);
console.log(`  Port: ${config.port}`);
console.log(`  CORS Origins: ${JSON.stringify(config.corsOrigins)}`);
console.log(`  Auth Rate Limit: ${config.rateLimit.auth.max} requests per ${config.rateLimit.auth.windowMs / 1000}s`);
console.log(`  JWT Secret: [REDACTED - ${config.jwtSecret.length} chars]`);

module.exports = config;
