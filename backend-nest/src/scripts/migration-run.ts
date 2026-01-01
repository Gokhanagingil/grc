/**
 * Migration Run Script
 *
 * Runs pending migrations idempotently (safe to run multiple times).
 * Exits with non-zero code on error.
 *
 * Usage:
 *   npm run migration:run      (dev - uses src mode)
 *   npm run migration:run:prod (staging/prod - uses dist mode)
 *
 * Environment variables:
 *   TYPEORM_MIGRATIONS_MODE - "dist" | "src" (default: auto-detect)
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 *   POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB (fallbacks)
 */

import { AppDataSource } from '../data-source';

interface MigrationRow {
  name: string;
}

function isMigrationRow(row: unknown): row is MigrationRow {
  return (
    typeof row === 'object' &&
    row !== null &&
    'name' in row &&
    typeof (row as { name: unknown }).name === 'string'
  );
}

async function runMigrations() {
  try {
    console.log('Connecting to database...');
    await AppDataSource.initialize();

    // Check pending migrations first
    const hasPendingMigrations = await AppDataSource.showMigrations();

    if (!hasPendingMigrations) {
      console.log('\n✓ No pending migrations. Database is up to date.\n');
      process.exit(0);
    }

    // Get list of pending migrations for display
    let pendingMigrationsList: string[] = [];
    try {
      const allMigrations = AppDataSource.migrations || [];
      const executedMigrationNames: unknown = await AppDataSource.query(
        `SELECT name FROM migrations`,
      );
      const executedNames = Array.isArray(executedMigrationNames)
        ? executedMigrationNames.filter(isMigrationRow).map((m) => m.name)
        : [];
      pendingMigrationsList = allMigrations
        .filter((m) => !executedNames.includes(m.name))
        .map((m) => m.name);
    } catch {
      // If migrations table doesn't exist, all migrations are pending
      const allMigrations = AppDataSource.migrations || [];
      pendingMigrationsList = allMigrations.map((m) => m.name);
    }

    if (pendingMigrationsList.length > 0) {
      console.log(
        `\nRunning ${pendingMigrationsList.length} pending migration(s)...\n`,
      );
      for (const migrationName of pendingMigrationsList) {
        console.log(`  - ${migrationName}`);
      }
      console.log('');
    }

    // Run migrations (idempotent - TypeORM handles this)
    const executedMigrations = await AppDataSource.runMigrations();

    if (executedMigrations.length === 0) {
      console.log('✓ No migrations were executed (already up to date).\n');
    } else {
      console.log(
        `\n✓ Successfully executed ${executedMigrations.length} migration(s):\n`,
      );
      for (const migration of executedMigrations) {
        console.log(`  ✓ ${migration.name}`);
      }
      console.log('');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error running migrations:');
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
      if (error.stack) {
        console.error(`\nStack trace:\n${error.stack}`);
      }
    } else {
      console.error('  Unknown error:', error);
    }
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

// Run the script
runMigrations().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
