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
  // Note: data-source.ts automatically detects test environment (NODE_ENV === 'test' OR JEST_WORKER_ID)
  // and forces 'src' mode, so we don't need to set TYPEORM_MIGRATIONS_MODE manually
  process.env.NODE_ENV = 'test';

  // Set database defaults (matching setup.ts to ensure consistency)
  // CI sets these via workflow env vars, so dotenv won't override them
  process.env.DB_HOST = process.env.DB_HOST || 'localhost';
  process.env.DB_PORT = process.env.DB_PORT || '5432';
  process.env.DB_USER = process.env.DB_USER || 'postgres';
  process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
  process.env.DB_NAME = process.env.DB_NAME || 'grc_platform_test';

  try {
    console.log('[E2E GlobalSetup] Initializing database connection...');
    await AppDataSource.initialize();

    console.log('[E2E GlobalSetup] Running migrations...');
    const executedMigrations = await AppDataSource.runMigrations();

    if (executedMigrations.length === 0) {
      console.log(
        '[E2E GlobalSetup] ✓ Database is up to date (no migrations executed)',
      );
    } else {
      console.log(
        `[E2E GlobalSetup] ✓ Executed ${executedMigrations.length} migration(s):`,
      );
      for (const migration of executedMigrations) {
        console.log(`[E2E GlobalSetup]   - ${migration.name}`);
      }
    }

    // Verify audit tables exist after migrations
    console.log('[E2E GlobalSetup] Verifying audit tables exist...');
    const grcAuditsResult = await AppDataSource.manager.query(
      `SELECT to_regclass('public.grc_audits') as grc_audits;`,
    );
    const grcAuditResult = await AppDataSource.manager.query(
      `SELECT to_regclass('public.grc_audit') as grc_audit;`,
    );

    const grcAuditsExists = grcAuditsResult[0]?.grc_audits !== null;
    const grcAuditExists = grcAuditResult[0]?.grc_audit !== null;

    console.log(
      `[E2E GlobalSetup] Audit table check: grc_audits=${grcAuditsExists ? 'EXISTS' : 'MISSING'}, grc_audit=${grcAuditExists ? 'EXISTS' : 'MISSING'}`,
    );

    if (!grcAuditsExists && !grcAuditExists) {
      const errorMessage =
        'Audit tables missing after migrations. Migrations set likely incomplete or wrong mode/glob.';
      console.error(`[E2E GlobalSetup] ✗ ${errorMessage}`);
      throw new Error(errorMessage);
    }

    // Optionally log executed migrations from migrations table
    try {
      const migrationsTableResult = await AppDataSource.manager.query(
        `SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 10;`,
      );
      if (migrationsTableResult.length > 0) {
        console.log(
          `[E2E GlobalSetup] Recent migrations from migrations table (${migrationsTableResult.length}):`,
        );
        for (const migration of migrationsTableResult) {
          console.log(
            `[E2E GlobalSetup]   - ${migration.name} (timestamp: ${migration.timestamp})`,
          );
        }
      }
    } catch {
      // If migrations table query fails, it's not critical - just log and continue
      console.log(
        '[E2E GlobalSetup] Could not query migrations table (this is optional)',
      );
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
