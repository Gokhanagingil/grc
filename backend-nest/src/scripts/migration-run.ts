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
import { getMigrationsTableNameFromConfig } from '../config/migrations-table-resolver';

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

/**
 * Extract timestamp from migration class name (last 13 digits)
 * TypeORM expects migrations to have a 13-digit timestamp at the end of the class name
 */
function extractTimestamp(migrationName: string): number {
  const match = migrationName.match(/(\d{13})$/);
  return match ? parseInt(match[1], 10) : 0;
}

async function runMigrations() {
  try {
    console.log('Connecting to database...');
    await AppDataSource.initialize();

    // CRITICAL: Sort migrations by timestamp BEFORE any operations
    // TypeORM's glob loading may return files in arbitrary order (often reverse alphabetical)
    // We must sort by timestamp to ensure correct execution order (oldest first)
    if (AppDataSource.migrations && AppDataSource.migrations.length > 0) {
      AppDataSource.migrations.sort((a, b) => {
        const nameA = a.name || a.constructor?.name || '';
        const nameB = b.name || b.constructor?.name || '';
        return extractTimestamp(nameA) - extractTimestamp(nameB);
      });
      console.log('[Migration] Sorted migrations by timestamp (ascending)');
    }

    // Get the migrations table name from DataSource config
    const migrationsTableName = getMigrationsTableNameFromConfig(AppDataSource);
    console.log(`Using migrations table: "${migrationsTableName}"`);

    // Check pending migrations first
    const hasPendingMigrations = await AppDataSource.showMigrations();

    if (!hasPendingMigrations) {
      console.log('\n✓ No pending migrations. Database is up to date.\n');
      process.exit(0);
    }

    // Get list of pending migrations for display
    // Sort migrations by timestamp (extracted from class name) to ensure correct execution order
    let pendingMigrationsList: string[] = [];
    try {
      const allMigrations = AppDataSource.migrations || [];
      const executedMigrationNames: unknown = await AppDataSource.query(
        `SELECT name FROM "${migrationsTableName}"`,
      );
      const executedNames = Array.isArray(executedMigrationNames)
        ? executedMigrationNames.filter(isMigrationRow).map((m) => m.name)
        : [];
      pendingMigrationsList = allMigrations
        .map((m) => m.name)
        .filter(
          (name): name is string => typeof name === 'string' && name.length > 0,
        )
        .filter((name) => !executedNames.includes(name))
        .sort((a, b) => {
          // Extract timestamp from migration name (e.g., "CreateTenantsTable1730000000000" -> 1730000000000)
          const timestampA = parseInt(a.match(/(\d{13})$/)?.[1] || '0', 10);
          const timestampB = parseInt(b.match(/(\d{13})$/)?.[1] || '0', 10);
          return timestampA - timestampB; // Ascending order (oldest first)
        });
    } catch {
      // If migrations table doesn't exist, all migrations are pending
      const allMigrations = AppDataSource.migrations || [];
      pendingMigrationsList = allMigrations
        .map((m) => m.name)
        .filter(
          (name): name is string => typeof name === 'string' && name.length > 0,
        )
        .sort((a, b) => {
          // Extract timestamp from migration name (e.g., "CreateTenantsTable1730000000000" -> 1730000000000)
          const timestampA = parseInt(a.match(/(\d{13})$/)?.[1] || '0', 10);
          const timestampB = parseInt(b.match(/(\d{13})$/)?.[1] || '0', 10);
          return timestampA - timestampB; // Ascending order (oldest first)
        });
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
