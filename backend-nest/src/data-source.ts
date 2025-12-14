import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file
config();

/**
 * Detect if we're running from the compiled dist directory
 * Checks if __filename includes 'dist' or if dist directory exists
 */
function isDistEnvironment(): boolean {
  // Check if __filename includes 'dist' (works for compiled JS)
  if (__filename.includes('dist')) {
    return true;
  }

  // Check if dist directory exists (fallback for edge cases)
  try {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath) && fs.statSync(distPath).isDirectory()) {
      // If we're in dist, we should be running from dist
      // If we're in src but dist exists, we're in dev mode
      return __dirname.includes('dist');
    }
  } catch {
    // If we can't check, assume dev mode
  }

  return false;
}

/**
 * TypeORM Data Source for CLI migrations
 *
 * This data source is used by the TypeORM CLI for running migrations.
 * It uses the same database configuration as the application.
 *
 * Usage:
 *   npm run migration:run    - Run pending migrations (dev)
 *   npx typeorm migration:run -d dist/data-source.js (prod)
 *   npm run migration:revert - Revert the last migration
 *
 * Environment variables:
 *   DB_HOST     - Database host (default: localhost)
 *   DB_PORT     - Database port (default: 5432)
 *   DB_USER     - Database user (default: postgres)
 *   DB_PASSWORD - Database password (default: postgres)
 *   DB_NAME     - Database name (default: grc_platform)
 *   POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB (fallbacks)
 */
const isDist = isDistEnvironment();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(
    process.env.DB_PORT || process.env.POSTGRES_PORT || '5432',
    10,
  ),
  username: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
  password:
    process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.DB_NAME || process.env.POSTGRES_DB || 'grc_platform',
  entities: isDist ? ['dist/**/*.entity.js'] : ['src/**/*.entity.ts'],
  migrations: isDist ? ['dist/migrations/*.js'] : ['src/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
