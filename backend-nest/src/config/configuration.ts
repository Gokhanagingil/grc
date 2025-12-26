/**
 * Application Configuration
 *
 * Maps validated environment variables to a typed configuration object.
 * All environment variables are validated via validation.ts before this function is called.
 * This function should only read from process.env for values that have been validated.
 *
 * Aligns with the existing Express backend's .env.example where possible.
 */
export default () => {
  // Note: At this point, env vars have been validated by the validate() function
  // We still use process.env here because NestJS ConfigModule loads this function
  // with the raw env, and validation happens separately. However, we ensure
  // all critical values have defaults or are required via validation.
  return {
    app: {
      port: parseInt(process.env.PORT ?? '3002', 10),
      nodeEnv: process.env.NODE_ENV ?? 'development',
    },
    jwt: {
      secret: process.env.JWT_SECRET ?? '', // Required by validation, but provide fallback for type safety
      expiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
      refreshSecret: process.env.REFRESH_TOKEN_SECRET ?? process.env.JWT_SECRET ?? '',
      refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d',
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
    },
    cors: {
      origins:
        process.env.CORS_ORIGINS ??
        'http://localhost:3000,http://localhost:3001,http://localhost:3002',
    },
    audit: {
      // Enable/disable audit logging (default: enabled)
      enabled: process.env.NEST_AUDIT_LOG_ENABLED ?? 'true',
    },
    demo: {
      // Demo admin credentials (used in tests and seeding)
      adminEmail: process.env.DEMO_ADMIN_EMAIL ?? 'admin@grc-platform.local',
      adminPassword: process.env.DEMO_ADMIN_PASSWORD ?? 'TestPassword123!',
    },
    api: {
      // API base URL (used in smoke tests and scripts)
      baseUrl: process.env.NEST_API_URL ?? 'http://localhost:3002',
    },
  };
};
