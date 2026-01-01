import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file
config();

/**
 * Resolve migration mode from environment variable or auto-detect
 *
 * Migration mode determines whether to load migrations from:
 * - "dist": dist/migrations/*.js (production/staging)
 * - "src": src/migrations/*.ts (development)
 *
 * Priority:
 * 1. TYPEORM_MIGRATIONS_MODE env var (explicit override)
 * 2. Auto-detect based on runtime environment (dist vs src)
 * 3. Default based on NODE_ENV: "dist" for production/staging, "src" for development
 *
 * Production/staging environments MUST use "dist" mode.
 */
function resolveMigrationMode(): 'dist' | 'src' {
  // Explicit mode override via environment variable
  const explicitMode = process.env.TYPEORM_MIGRATIONS_MODE;
  if (explicitMode === 'dist' || explicitMode === 'src') {
    console.log(
      `[TypeORM] Migration mode: ${explicitMode} (explicit via TYPEORM_MIGRATIONS_MODE)`,
    );
    return explicitMode;
  }

  // Auto-detect based on runtime environment
  const isDist = isDistEnvironment();
  
  // For production/staging, default to "dist" even if auto-detection fails
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProductionEnv = nodeEnv === 'production' || nodeEnv === 'staging';
  
  let mode: 'dist' | 'src';
  if (isDist) {
    mode = 'dist';
  } else if (isProductionEnv) {
    // Production/staging must use "dist" mode
    mode = 'dist';
    console.log(
      `[TypeORM] Migration mode: ${mode} (forced for ${nodeEnv} environment)`,
    );
  } else {
    mode = 'src';
  }
  
  if (!isProductionEnv || isDist) {
    console.log(
      `[TypeORM] Migration mode: ${mode} (auto-detected from runtime environment)`,
    );
  }
  
  return mode;
}

/**
 * Detect if we're running from the compiled dist directory
 *
 * Uses __dirname (which is available in CommonJS) to determine if we're
 * running from the compiled dist directory. This is the most reliable
 * method for TypeORM CLI usage in production/staging environments.
 *
 * When running from dist/data-source.js:
 *   __dirname will be: /app/dist (Docker) or <project>/backend-nest/dist (local)
 *   __filename will be: /app/dist/data-source.js
 *
 * When running from src/data-source.ts (dev):
 *   __dirname will be: <project>/backend-nest/src
 *   __filename will be: <project>/backend-nest/src/data-source.ts
 */
function isDistEnvironment(): boolean {
  try {
    // Primary check: __filename is the most reliable indicator
    // In dist: ends with .js and contains 'dist' in path
    // In src: ends with .ts or contains 'src' in path
    const filename = __filename || '';
    if (
      filename.endsWith('.js') &&
      filename.includes(path.sep + 'dist' + path.sep)
    ) {
      return true;
    }
    if (
      filename.endsWith('.ts') ||
      filename.includes(path.sep + 'src' + path.sep)
    ) {
      return false;
    }

    // Secondary check: __dirname path
    const currentDir = path.resolve(__dirname);
    if (
      currentDir.includes(path.sep + 'dist' + path.sep) ||
      currentDir.endsWith(path.sep + 'dist')
    ) {
      return true;
    }
    if (
      currentDir.includes(path.sep + 'src' + path.sep) ||
      currentDir.endsWith(path.sep + 'src')
    ) {
      return false;
    }

    // Fallback: Check file system (for edge cases in Docker containers)
    // If dist/data-source.js exists and we're executing a .js file, we're in dist
    try {
      const cwd = process.cwd();
      const distDataSourcePath = path.join(cwd, 'dist', 'data-source.js');
      const srcDataSourcePath = path.join(cwd, 'src', 'data-source.ts');

      if (fs.existsSync(distDataSourcePath) && filename.endsWith('.js')) {
        // If dist/data-source.js exists and we're running a .js file, we're likely in dist
        if (!fs.existsSync(srcDataSourcePath)) {
          return true;
        }
        // If both exist, prefer dist if filename indicates dist
        if (filename.includes('dist')) {
          return true;
        }
      }
    } catch {
      // File system check failed, continue with other logic
    }

    return false;
  } catch {
    // If all checks fail, default to dev mode (src) for safety
    return false;
  }
}

/**
 * TypeORM Data Source for CLI migrations
 *
 * This data source is used by the TypeORM CLI for running migrations.
 * It uses the same database configuration as the application.
 *
 * Migration loading strategy:
 * - Uses glob patterns to load migration files directly
 * - In "src" mode: loads from src/migrations/*.ts (excludes index.ts via pattern)
 * - In "dist" mode: loads from dist/migrations/*.js (excludes index.js via pattern)
 * - IMPORTANT: We must NOT have dist/migrations/index.js to avoid duplicate migrations
 *
 * Usage:
 *   npm run migration:status  - Check pending migrations (dev)
 *   npm run migration:run     - Run pending migrations (dev)
 *   npm run migration:status:prod - Check pending migrations (staging/prod)
 *   npm run migration:run:prod    - Run pending migrations (staging/prod)
 *   npm run migration:revert  - Revert the last migration
 *
 * Environment variables:
 *   TYPEORM_MIGRATIONS_MODE - Explicit mode: "dist" | "src" (default: auto-detect)
 *   DB_HOST     - Database host (default: localhost)
 *   DB_PORT     - Database port (default: 5432)
 *   DB_USER     - Database user (default: postgres)
 *   DB_PASSWORD - Database password (default: postgres)
 *   DB_NAME     - Database name (default: grc_platform)
 *   POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB (fallbacks)
 */
const migrationMode = resolveMigrationMode();

const AppDataSource = new DataSource({
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
  entities:
    migrationMode === 'dist'
      ? ['dist/**/*.entity.js']
      : ['src/**/*.entity.ts'],
  migrations:
    migrationMode === 'dist'
      ? ['dist/migrations/*.js']
      : ['src/migrations/*.ts'],
  synchronize: false, // NEVER enable synchronize - always use migrations
  logging: process.env.NODE_ENV === 'development',
});

// Export for TypeORM CLI
// TypeORM CLI expects either AppDataSource or DataSource export
export { AppDataSource };
