/**
 * E2E Test Global Setup
 *
 * This file runs ONCE before all e2e tests to ensure the test database
 * has all migrations applied. This is necessary because synchronize is
 * disabled (for staging/prod safety) and migrations must be run explicitly.
 *
 * For tests, we use "src" mode since we're running TypeScript directly via ts-jest.
 */
import * as path from 'path';
import { config } from 'dotenv';
import { AppDataSource } from '../src/data-source';

export default async function globalSetup(): Promise<void> {
  // Load .env.test file for local development (CI sets env vars directly)
  config({ path: path.resolve(__dirname, '../.env.test') });
  config({ path: path.resolve(__dirname, '../.env.test.local') });
  
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Set database defaults (matching setup.ts to ensure consistency)
  // CI sets these via workflow env vars, so dotenv won't override them
  process.env.DB_HOST = process.env.DB_HOST || 'localhost';
  process.env.DB_PORT = process.env.DB_PORT || '5432';
  process.env.DB_USER = process.env.DB_USER || 'postgres';
  process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
  process.env.DB_NAME = process.env.DB_NAME || 'grc_platform_test';
  
  // Force "src" mode for tests (we're running TypeScript, not compiled JS)
  process.env.TYPEORM_MIGRATIONS_MODE = 'src';
  
  try {
    console.log('[E2E GlobalSetup] Initializing database connection...');
    await AppDataSource.initialize();

    console.log('[E2E GlobalSetup] Running migrations...');
    const executedMigrations = await AppDataSource.runMigrations();

    if (executedMigrations.length === 0) {
      console.log('[E2E GlobalSetup] ✓ Database is up to date (no migrations executed)');
    } else {
      console.log(
        `[E2E GlobalSetup] ✓ Executed ${executedMigrations.length} migration(s):`,
      );
      for (const migration of executedMigrations) {
        console.log(`[E2E GlobalSetup]   - ${migration.name}`);
      }
    }

    console.log('[E2E GlobalSetup] Closing database connection...');
    await AppDataSource.destroy();
    console.log('[E2E GlobalSetup] ✓ Setup complete');
  } catch (error) {
    console.error('[E2E GlobalSetup] ✗ Error during setup:');
    if (error instanceof Error) {
      console.error(`[E2E GlobalSetup]   ${error.message}`);
      if (error.stack) {
        console.error(`[E2E GlobalSetup] Stack trace:\n${error.stack}`);
      }
    } else {
      console.error('[E2E GlobalSetup]   Unknown error:', error);
    }
    
    // Clean up connection if it was initialized
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    
    // Re-throw to fail the test run
    throw error;
  }
}

