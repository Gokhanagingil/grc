/**
 * Migration Validation Script
 *
 * Validates database migration status, checks for pending migrations,
 * and reports on executed migrations. Supports JSON output for CI.
 *
 * Usage:
 *   npm run validate:migrations           - Human-readable output
 *   npm run validate:migrations -- --json - JSON output for CI
 *
 * Exit codes:
 *   0 - All migrations are applied (no pending)
 *   1 - Pending migrations exist or error occurred
 */

import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

config();

interface MigrationRecord {
  id: number;
  timestamp: number;
  name: string;
}

interface ValidationResult {
  success: boolean;
  timestamp: string;
  environment: string;
  migrations: {
    executed: number;
    pending: number;
    lastExecuted: string | null;
    lastExecutedAt: string | null;
    pendingList: string[];
    executedList: string[];
  };
  checks: {
    migrationsTableExists: boolean;
    migrationFilesFound: number;
    syncMode: boolean;
  };
  errors: string[];
  warnings: string[];
}

function isDistEnvironment(): boolean {
  try {
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
    return false;
  } catch {
    return false;
  }
}

function getMigrationFiles(): string[] {
  const isDist = isDistEnvironment();
  const baseDir = isDist
    ? path.join(process.cwd(), 'dist', 'migrations')
    : path.join(process.cwd(), 'src', 'migrations');

  try {
    if (!fs.existsSync(baseDir)) {
      return [];
    }

    const ext = isDist ? '.js' : '.ts';
    const files = fs
      .readdirSync(baseDir)
      .filter((f) => f.endsWith(ext) && !f.includes('index'));

    return files.map((f) => f.replace(ext, ''));
  } catch {
    return [];
  }
}

async function validateMigrations(): Promise<ValidationResult> {
  const timestamp = new Date().toISOString();
  const environment = process.env.NODE_ENV || 'development';
  const errors: string[] = [];
  const warnings: string[] = [];

  const result: ValidationResult = {
    success: false,
    timestamp,
    environment,
    migrations: {
      executed: 0,
      pending: 0,
      lastExecuted: null,
      lastExecutedAt: null,
      pendingList: [],
      executedList: [],
    },
    checks: {
      migrationsTableExists: false,
      migrationFilesFound: 0,
      syncMode: process.env.DB_SYNC === 'true',
    },
    errors,
    warnings,
  };

  // Check sync mode warning
  if (result.checks.syncMode) {
    if (environment === 'production') {
      errors.push('DB_SYNC=true is dangerous in production!');
    } else {
      warnings.push(
        'DB_SYNC=true is enabled. Migrations may not be tracked accurately.',
      );
    }
  }

  // Get migration files
  const migrationFiles = getMigrationFiles();
  result.checks.migrationFilesFound = migrationFiles.length;

  if (migrationFiles.length === 0) {
    warnings.push('No migration files found in migrations directory.');
  }

  const dataSource = new DataSource({
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
    connectTimeoutMS: 10000,
  });

  try {
    await dataSource.initialize();

    // Check if migrations table exists
    const tableExistsResult: Array<{ exists: boolean }> =
      await dataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'migrations'
      );
    `);
    result.checks.migrationsTableExists = tableExistsResult[0]?.exists || false;

    if (!result.checks.migrationsTableExists) {
      warnings.push(
        'Migrations table does not exist. Run migrations first: npm run migration:run',
      );
      result.success = migrationFiles.length === 0; // Success if no migrations needed
      return result;
    }

    // Get executed migrations
    const executedMigrations: MigrationRecord[] = await dataSource.query(`
      SELECT id, timestamp, name 
      FROM migrations 
      ORDER BY timestamp DESC
    `);

    result.migrations.executed = executedMigrations.length;
    result.migrations.executedList = executedMigrations.map((m) => m.name);

    if (executedMigrations.length > 0) {
      const lastMigration = executedMigrations[0];
      result.migrations.lastExecuted = lastMigration.name;
      result.migrations.lastExecutedAt = new Date(
        lastMigration.timestamp,
      ).toISOString();
    }

    // Calculate pending migrations
    const executedNames = new Set(executedMigrations.map((m) => m.name));
    const pendingMigrations = migrationFiles.filter(
      (f) => !executedNames.has(f),
    );

    result.migrations.pending = pendingMigrations.length;
    result.migrations.pendingList = pendingMigrations;

    if (pendingMigrations.length > 0) {
      warnings.push(
        `${pendingMigrations.length} pending migration(s) found. Run: npm run migration:run`,
      );
    }

    // Success if no pending migrations (or sync mode is on)
    result.success =
      pendingMigrations.length === 0 || result.checks.syncMode === true;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Migration validation failed: ${errorMessage}`);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }

  return result;
}

function printHumanReadable(result: ValidationResult): void {
  console.log('========================================');
  console.log('Migration Validation');
  console.log('========================================');
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Environment: ${result.environment}`);
  console.log('');

  console.log('--- Migration Status ---');
  console.log(`Executed: ${result.migrations.executed}`);
  console.log(`Pending: ${result.migrations.pending}`);
  if (result.migrations.lastExecuted) {
    console.log(`Last Executed: ${result.migrations.lastExecuted}`);
    console.log(`Last Executed At: ${result.migrations.lastExecutedAt}`);
  }
  console.log('');

  console.log('--- Checks ---');
  const tableIcon = result.checks.migrationsTableExists ? '[OK]' : '[WARN]';
  console.log(`${tableIcon} Migrations table exists`);
  console.log(`Migration files found: ${result.checks.migrationFilesFound}`);
  const syncIcon = result.checks.syncMode ? '[WARN]' : '[OK]';
  console.log(`${syncIcon} Sync mode: ${result.checks.syncMode}`);
  console.log('');

  if (result.migrations.pendingList.length > 0) {
    console.log('--- Pending Migrations ---');
    for (const name of result.migrations.pendingList) {
      console.log(`  - ${name}`);
    }
    console.log('');
  }

  if (result.warnings.length > 0) {
    console.log('--- Warnings ---');
    for (const warning of result.warnings) {
      console.log(`[WARN] ${warning}`);
    }
    console.log('');
  }

  if (result.errors.length > 0) {
    console.log('--- Errors ---');
    for (const error of result.errors) {
      console.log(`[ERROR] ${error}`);
    }
    console.log('');
  }

  console.log('========================================');
  if (result.success) {
    console.log('[SUCCESS] Migration validation passed');
  } else {
    console.log('[FAILED] Migration validation failed');
  }
  console.log('========================================');
}

function printJson(result: ValidationResult): void {
  console.log(JSON.stringify(result, null, 2));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');

  const result = await validateMigrations();

  if (jsonOutput) {
    printJson(result);
  } else {
    printHumanReadable(result);
  }

  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
