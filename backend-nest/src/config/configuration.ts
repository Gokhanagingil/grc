/**
 * Application Configuration
 * 
 * Maps environment variables to a typed configuration object.
 * Aligns with the existing Express backend's .env.example where possible.
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
  },
  cors: {
    origins: process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001,http://localhost:3002',
  },
});
