import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildTypeORMDataSourceOptions,
  getDatabaseConnectionConfig,
  formatConnectionConfigForLogging,
} from './config/database-config';

// Load environment variables from .env file
config();

/**
 * Resolve migration mode from environment variable or auto-detect
 *
 * Migration mode determines whether to load migrations from:
 * - "dist": dist/migrations/*.js (production/staging)
 * - "src": src/migrations/*.ts (development/test)
 *
 * Priority (test safety first):
 * 1. Test environment (NODE_ENV === 'test' OR JEST_WORKER_ID is set) → ALWAYS 'src'
 * 2. Production/staging (NODE_ENV === 'production' || 'staging') → ALWAYS 'dist'
 * 3. TYPEORM_MIGRATIONS_MODE env var (explicit override, but NOT in test)
 * 4. Auto-detect based on runtime environment (dist vs src)
 * 5. Default: 'src' for development
 *
 * Production/staging environments MUST use "dist" mode.
 * Test environments MUST use "src" mode (cannot be overridden).
 */
function resolveMigrationMode(): 'dist' | 'src' {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isJestWorker = !!process.env.JEST_WORKER_ID;
  const isTestEnv = nodeEnv === 'test' || isJestWorker;
  const isProductionEnv = nodeEnv === 'production' || nodeEnv === 'staging';

  // TEST SAFETY: Test environment MUST always use 'src' mode
  // This cannot be overridden by TYPEORM_MIGRATIONS_MODE
  if (isTestEnv) {
    console.log(
      `[TypeORM] Migration mode: src (forced for test environment - NODE_ENV=${nodeEnv}${isJestWorker ? ', JEST_WORKER_ID set' : ''})`,
    );
    return 'src';
  }

  // Production/staging MUST use 'dist' mode
  if (isProductionEnv) {
    console.log(
      `[TypeORM] Migration mode: dist (forced for ${nodeEnv} environment)`,
    );
    return 'dist';
  }

  // Explicit mode override via environment variable (only if not in test)
  const explicitMode = process.env.TYPEORM_MIGRATIONS_MODE;
  if (explicitMode === 'dist' || explicitMode === 'src') {
    console.log(
      `[TypeORM] Migration mode: ${explicitMode} (explicit via TYPEORM_MIGRATIONS_MODE)`,
    );
    return explicitMode;
  }

  // Auto-detect based on runtime environment
  const isDist = isDistEnvironment();
  const mode = isDist ? 'dist' : 'src';
  console.log(
    `[TypeORM] Migration mode: ${mode} (auto-detected from runtime environment)`,
  );

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

// Resolve migrations glob pattern based on mode using ABSOLUTE paths
// This ensures migrations are found regardless of process.cwd()
// __dirname is: backend-nest/src when running from src, backend-nest/dist when running from dist
const migrationsDir = path.join(__dirname, 'migrations');
const migrationsExtension = migrationMode === 'dist' ? '*.js' : '*.ts';
const migrationsGlob = [path.join(migrationsDir, migrationsExtension)];

// Log resolved migrations glob (safe, no secrets)
console.log(
  `[TypeORM] Resolved migrations glob: ${JSON.stringify(migrationsGlob)}`,
);
console.log(
  `[TypeORM] Migration discovery: __dirname=${__dirname}, process.cwd()=${process.cwd()}`,
);

// Use canonical database connection config builder
const dbConfig = getDatabaseConnectionConfig();
const baseDataSourceOptions = buildTypeORMDataSourceOptions();

console.log(
  `[TypeORM] Database connection: ${formatConnectionConfigForLogging(dbConfig)}`,
);

const AppDataSource = new DataSource({
  ...baseDataSourceOptions,
  entities:
    migrationMode === 'dist' ? ['dist/**/*.entity.js'] : ['src/**/*.entity.ts'],
  migrations: migrationsGlob,
  migrationsTableName: 'typeorm_migrations', // Explicit table name to prevent collisions
  logging: process.env.NODE_ENV === 'development',
});

// Export for TypeORM CLI
// TypeORM CLI expects either AppDataSource or DataSource export
export { AppDataSource };
