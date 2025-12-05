/**
 * Application Configuration
 *
 * Maps environment variables to a typed configuration object.
 * Aligns with the existing Express backend's .env.example where possible.
 *
 * Production Readiness:
 * - DB retry configuration for resilient connections
 * - Audit fallback configuration
 */
export default () => ({
  app: {
    port: parseInt(process.env.PORT ?? '3002', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
  },
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    name: process.env.DB_NAME ?? 'grc_platform',
    // Only enable synchronize in development - NEVER in production
    // This allows TypeORM to auto-create tables for the Nest entities
    synchronize: process.env.DB_SYNC === 'true',
    // Retry configuration for resilient DB connections
    retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS ?? '10', 10),
    retryDelay: parseInt(process.env.DB_RETRY_DELAY ?? '500', 10),
  },
  cors: {
    origins:
      process.env.CORS_ORIGINS ??
      'http://localhost:3000,http://localhost:3001,http://localhost:3002',
  },
  audit: {
    // Enable/disable audit logging (default: enabled)
    enabled: process.env.NEST_AUDIT_LOG_ENABLED ?? 'true',
    // Fallback file for failed audit writes
    fallbackFile: process.env.AUDIT_FALLBACK_FILE ?? 'audit-failures.log',
    // Retry configuration for audit writes
    retryAttempts: parseInt(process.env.AUDIT_RETRY_ATTEMPTS ?? '3', 10),
    retryDelayMs: parseInt(process.env.AUDIT_RETRY_DELAY_MS ?? '100', 10),
  },
});
