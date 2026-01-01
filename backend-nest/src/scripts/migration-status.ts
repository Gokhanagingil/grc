/**
 * Migration Status Script
 *
 * Prints the count of pending migrations (never silent).
 * Exits with non-zero code if there are pending migrations or on error.
 *
 * Usage:
 *   npm run migration:status      (dev - uses src mode)
 *   npm run migration:status:prod  (staging/prod - uses dist mode)
 *
 * Environment variables:
 *   TYPEORM_MIGRATIONS_MODE - "dist" | "src" (default: auto-detect)
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 *   POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB (fallbacks)
 */

import { AppDataSource } from '../data-source';

interface CountRow {
  count: string | number;
}

interface MigrationRow {
  name: string;
}

function isCountRow(row: unknown): row is CountRow {
  return (
    typeof row === 'object' &&
    row !== null &&
    'count' in row &&
    (typeof (row as { count: unknown }).count === 'string' ||
      typeof (row as { count: unknown }).count === 'number')
  );
}

function isMigrationRow(row: unknown): row is MigrationRow {
  return (
    typeof row === 'object' &&
    row !== null &&
    'name' in row &&
    typeof (row as { name: unknown }).name === 'string'
  );
}

function parseCount(count: string | number): number {
  if (typeof count === 'number') {
    return count;
  }
  const parsed = parseInt(count, 10);
  return isNaN(parsed) ? 0 : parsed;
}

async function checkMigrationStatus() {
  try {
    console.log('Connecting to database...');
    await AppDataSource.initialize();

    // Check if there are pending migrations using TypeORM API
    const hasPendingMigrations = await AppDataSource.showMigrations();

    // Get executed migrations count
    let executedCount = 0;
    let pendingMigrationsList: string[] = [];
    try {
      const executedMigrations: unknown = await AppDataSource.query(
        `SELECT COUNT(*) as count FROM migrations`,
      );
      if (
        Array.isArray(executedMigrations) &&
        executedMigrations.length > 0 &&
        isCountRow(executedMigrations[0])
      ) {
        executedCount = parseCount(executedMigrations[0].count);
      }

      // Get list of all migration files and compare with executed ones
      if (hasPendingMigrations) {
        const allMigrations = AppDataSource.migrations || [];
        const executedMigrationNames: unknown = await AppDataSource.query(
          `SELECT name FROM migrations`,
        );
        const executedNames = Array.isArray(executedMigrationNames)
          ? executedMigrationNames.filter(isMigrationRow).map((m) => m.name)
          : [];
        pendingMigrationsList = allMigrations
          .map((m) => m.name)
          .filter(
            (name): name is string =>
              typeof name === 'string' && name.length > 0,
          )
          .filter((name) => !executedNames.includes(name));
      }
    } catch (queryError) {
      // If migrations table doesn't exist, all migrations are pending
      if (
        queryError instanceof Error &&
        queryError.message.includes('does not exist')
      ) {
        const allMigrations = AppDataSource.migrations || [];
        pendingMigrationsList = allMigrations
          .map((m) => m.name)
          .filter(
            (name): name is string =>
              typeof name === 'string' && name.length > 0,
          );
        executedCount = 0;
      } else {
        throw queryError;
      }
    }

    // Always print status (never silent)
    if (!hasPendingMigrations || pendingMigrationsList.length === 0) {
      console.log('\n✓ Migration Status: 0 pending migrations');
      console.log(`  Executed migrations: ${executedCount}`);
      console.log('  Database is up to date.\n');
      process.exit(0);
    } else {
      console.log(
        `\n⚠ Migration Status: ${pendingMigrationsList.length} pending migration(s)`,
      );
      console.log(`  Executed migrations: ${executedCount}`);
      console.log('\n  Pending migrations:');
      for (const migrationName of pendingMigrationsList) {
        console.log(`    - ${migrationName}`);
      }
      console.log(
        '\n  Run migrations: npm run migration:run (dev) or npm run migration:run:prod (staging/prod)\n',
      );
      process.exit(1);
    }
  } catch (error) {
    console.error('\n✗ Error checking migration status:');
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
checkMigrationStatus().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
