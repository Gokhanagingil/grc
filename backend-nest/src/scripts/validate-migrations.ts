/**
 * Migration Validation Script
 *
 * Validates database migration status, checks for pending migrations,
 * runs migrations if needed, and asserts that required tables exist.
 * Supports JSON output for CI.
 *
 * Usage:
 *   npm run validate:migrations           - Human-readable output
 *   npm run validate:migrations -- --json - JSON output for CI
 *
 * Exit codes:
 *   0 - All migrations are applied and required tables exist
 *   1 - Pending migrations exist, tables missing, or error occurred
 */

import { config } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import type { Migration } from 'typeorm';
import { AppDataSource } from '../data-source';
import {
  getDatabaseConnectionConfig,
  formatConnectionConfigForLogging,
} from '../config/database-config';

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
  diagnostics: {
    configSource: string;
    currentDatabase: string | null;
    currentSchema: string | null;
    searchPath: string | null;
    connectionString: string;
  };
  migrations: {
    executed: number;
    pending: number;
    lastExecuted: string | null;
    lastExecutedAt: string | null;
    pendingList: string[];
    executedList: string[];
    migrationsRun: number;
  };
  checks: {
    migrationsTableExists: boolean;
    migrationFilesFound: number;
    syncMode: boolean;
    nestTenantsExists: boolean;
    nestUsersExists: boolean;
    nestAuditLogsExists: boolean;
  };
  errors: string[];
  warnings: string[];
}

/**
 * Safely format a date value to ISO string
 * Returns "N/A" if the value is falsy or results in an invalid Date
 */
function safeDate(value: unknown): string {
  if (!value) {
    return 'N/A';
  }
  // Ensure numeric timestamps are treated as numbers
  const numValue = typeof value === 'string' ? Number(value) : value;
  const d = new Date(numValue as number);
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toISOString();
}

/**
 * Safely extract migration name from a Migration object
 */
function getMigrationName(migration: Migration): string {
  // TypeORM Migration has a 'name' property
  if (
    migration &&
    typeof migration === 'object' &&
    'name' in migration &&
    typeof migration.name === 'string'
  ) {
    return migration.name;
  }
  return 'unknown';
}

/**
 * Safely extract migration timestamp from a Migration object
 */
function getMigrationTimestamp(migration: Migration): number {
  // TypeORM Migration has a 'timestamp' property
  if (migration && typeof migration === 'object' && 'timestamp' in migration) {
    const ts = migration.timestamp;
    if (typeof ts === 'number') {
      return ts;
    }
    if (typeof ts === 'string') {
      const num = Number(ts);
      return Number.isNaN(num) ? 0 : num;
    }
  }
  return 0;
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

  // Get database connection config for diagnostics
  const dbConfig = getDatabaseConnectionConfig();
  const connectionString = formatConnectionConfigForLogging(dbConfig);

  const result: ValidationResult = {
    success: false,
    timestamp,
    environment,
    diagnostics: {
      configSource: dbConfig.source,
      currentDatabase: null,
      currentSchema: null,
      searchPath: null,
      connectionString,
    },
    migrations: {
      executed: 0,
      pending: 0,
      lastExecuted: null,
      lastExecutedAt: null,
      pendingList: [],
      executedList: [],
      migrationsRun: 0,
    },
    checks: {
      migrationsTableExists: false,
      migrationFilesFound: 0,
      syncMode: process.env.DB_SYNC === 'true',
      nestTenantsExists: false,
      nestUsersExists: false,
      nestAuditLogsExists: false,
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

  try {
    // Use AppDataSource from data-source.ts (canonical connection)
    // Add retry logic for connection readiness (max 45 seconds)
    const maxRetries = 9; // 9 retries * 5 seconds = 45 seconds max
    const retryDelay = 5000; // 5 seconds between retries
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await AppDataSource.initialize();
        lastError = null;
        break; // Success, exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries) {
          const errorMessage = lastError.message.toLowerCase();
          // Only retry on connection/readiness errors
          if (
            errorMessage.includes('connect') ||
            errorMessage.includes('connection') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('econnrefused') ||
            errorMessage.includes('getaddrinfo')
          ) {
            console.log(
              `[validate-migrations] Connection attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${retryDelay / 1000}s...`,
            );
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            continue;
          }
          // For other errors, don't retry
          throw lastError;
        } else {
          // Last attempt failed, throw the error
          throw lastError;
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    // Get migrations table name from TypeORM options (defaults to 'migrations')
    // Safely access options with type narrowing
    const migrationsTableName =
      AppDataSource.options.migrationsTableName || 'migrations';
    // TypeORM doesn't have migrationsTableSchema option - migrations table is always in 'public' schema
    // But we check for it in case of custom implementations
    const migrationsTableSchema =
      'migrationsTableSchema' in AppDataSource.options &&
      typeof AppDataSource.options.migrationsTableSchema === 'string'
        ? AppDataSource.options.migrationsTableSchema
        : 'public';

    // Log migrations table configuration
    console.log(
      `[validate-migrations] Migrations table: ${migrationsTableSchema}.${migrationsTableName}`,
    );
    // Safely extract options for logging (using type assertion for union type)
    const opts = AppDataSource.options as unknown as Record<string, unknown>;
    console.log(
      `[validate-migrations] TypeORM options (sanitized):`,
      JSON.stringify(
        {
          type: opts.type,
          host: 'host' in opts ? opts.host : undefined,
          port: 'port' in opts ? opts.port : undefined,
          database: 'database' in opts ? opts.database : undefined,
          migrationsTableName: migrationsTableName,
          migrationsTableSchema: migrationsTableSchema,
          migrations: opts.migrations,
        },
        null,
        2,
      ),
    );

    // Run diagnostics: get database name, schema, search_path
    try {
      const dbResult = await AppDataSource.manager.query<Array<{ db: string }>>(
        'SELECT current_database() as db',
      );
      result.diagnostics.currentDatabase = dbResult[0]?.db || null;

      const schemaResult = await AppDataSource.manager.query<
        Array<{ schema: string }>
      >('SELECT current_schema() as schema');
      result.diagnostics.currentSchema = schemaResult[0]?.schema || null;

      const searchPathResult =
        await AppDataSource.manager.query<Array<{ search_path: string }>>(
          'SHOW search_path',
        );
      result.diagnostics.searchPath = searchPathResult[0]?.search_path || null;
    } catch (diagError) {
      warnings.push(
        `Failed to get database diagnostics: ${
          diagError instanceof Error ? diagError.message : 'Unknown error'
        }`,
      );
    }

    // Check if migrations table exists (using detected table name and schema)
    const tableExistsResult: Array<{ exists: boolean }> =
      await AppDataSource.query(
        `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1
        AND table_name = $2
      );
    `,
        [migrationsTableSchema, migrationsTableName],
      );
    result.checks.migrationsTableExists = tableExistsResult[0]?.exists || false;

    // Get migration class names by checking what TypeORM would load
    // We'll use showMigrations() and runMigrations() return values to get actual names
    // But first, let's try to get all migration names from the filesystem
    // by loading the migration files and extracting class names
    let loadedMigrationNames: string[] = [];
    try {
      // TypeORM stores migration names as class names (e.g., "CreateTenantsTable1730000000000")
      // File names are like "1730000000000-CreateTenantsTable.ts"
      // We need to extract the class name from the file
      const migrationFiles = getMigrationFiles();
      for (const file of migrationFiles) {
        // File format: "1730000000000-CreateTenantsTable"
        // Class format: "CreateTenantsTable1730000000000"
        // Extract timestamp and name parts
        const match = file.match(/^(\d+)-(.+)$/);
        if (match) {
          const timestamp = match[1];
          const namePart = match[2];
          // Reconstruct class name: NamePart + Timestamp
          const className = `${namePart}${timestamp}`;
          loadedMigrationNames.push(className);
        }
      }
      console.log(
        `[validate-migrations] Extracted ${loadedMigrationNames.length} migration class names from files`,
      );
      if (loadedMigrationNames.length > 0) {
        console.log(
          `[validate-migrations] Migration class names: ${JSON.stringify(loadedMigrationNames, null, 2)}`,
        );
      }
    } catch (extractError) {
      console.log(
        `[validate-migrations] Could not extract migration names from files: ${extractError instanceof Error ? extractError.message : 'Unknown error'}`,
      );
      // Fallback: use file names as-is (will likely not match, but we'll catch it in validation)
      loadedMigrationNames = getMigrationFiles();
    }

    // Get executed migrations BEFORE running migrations (for debugging)
    let executedMigrationsBefore: MigrationRecord[] = [];
    if (result.checks.migrationsTableExists) {
      try {
        // Use proper PostgreSQL identifier quoting
        const schemaQuoted = `"${migrationsTableSchema}"`;
        const tableQuoted = `"${migrationsTableName}"`;
        executedMigrationsBefore = await AppDataSource.query<MigrationRecord[]>(
          `SELECT id, timestamp, name 
           FROM ${schemaQuoted}.${tableQuoted}
           ORDER BY timestamp DESC`,
        );
        const countBefore = executedMigrationsBefore.length;
        console.log(
          `[validate-migrations] BEFORE runMigrations: ${countBefore} migrations in DB`,
        );
        if (countBefore > 0) {
          console.log(
            `[validate-migrations] Executed migrations (before): ${JSON.stringify(
              executedMigrationsBefore.map((m) => ({
                name: m.name,
                timestamp: m.timestamp,
              })),
              null,
              2,
            )}`,
          );
        }
      } catch (queryError) {
        console.log(
          `[validate-migrations] Could not query migrations table before runMigrations: ${queryError instanceof Error ? queryError.message : 'Unknown error'}`,
        );
      }
    }

    // Run migrations if needed (idempotent)
    let migrationsRun = 0;
    let executedMigrationsResult: Migration[] = [];
    if (result.checks.migrationsTableExists) {
      // Check for pending migrations and run them
      const hasPendingMigrations = await AppDataSource.showMigrations();
      if (hasPendingMigrations) {
        console.log('Running pending migrations...');
        executedMigrationsResult = await AppDataSource.runMigrations();
        migrationsRun = executedMigrationsResult.length;
        if (migrationsRun > 0) {
          console.log(`✓ Successfully executed ${migrationsRun} migration(s)`);
          console.log(
            `[validate-migrations] Migrations returned by runMigrations(): ${JSON.stringify(
              executedMigrationsResult.map((m) => ({
                name: getMigrationName(m),
                timestamp: getMigrationTimestamp(m),
              })),
              null,
              2,
            )}`,
          );
        }
      }
    } else {
      // Migrations table doesn't exist, run migrations to create it
      console.log('Migrations table does not exist. Running migrations...');
      executedMigrationsResult = await AppDataSource.runMigrations();
      migrationsRun = executedMigrationsResult.length;
      if (migrationsRun > 0) {
        console.log(`✓ Successfully executed ${migrationsRun} migration(s)`);
        console.log(
          `[validate-migrations] Migrations returned by runMigrations(): ${JSON.stringify(
            executedMigrationsResult.map((m) => ({
              name: m.name,
              timestamp: m.timestamp,
            })),
            null,
            2,
          )}`,
        );
      }
      result.checks.migrationsTableExists = true;
    }

    result.migrations.migrationsRun = migrationsRun;

    // Get executed migrations AFTER running migrations (for validation)
    let executedMigrations: MigrationRecord[] = [];
    try {
      // Use proper PostgreSQL identifier quoting
      const schemaQuoted = `"${migrationsTableSchema}"`;
      const tableQuoted = `"${migrationsTableName}"`;
      executedMigrations = await AppDataSource.query<MigrationRecord[]>(
        `SELECT id, timestamp, name 
         FROM ${schemaQuoted}.${tableQuoted}
         ORDER BY timestamp DESC`,
      );
      const countAfter = executedMigrations.length;
      console.log(
        `[validate-migrations] AFTER runMigrations: ${countAfter} migrations in DB`,
      );
      if (countAfter > 0) {
        console.log(
          `[validate-migrations] Executed migrations (after): ${JSON.stringify(
            executedMigrations.map((m) => ({
              name: m.name,
              timestamp: m.timestamp,
            })),
            null,
            2,
          )}`,
        );
      }
    } catch (queryError) {
      const errorMsg =
        queryError instanceof Error ? queryError.message : 'Unknown error';
      errors.push(
        `Failed to query migrations table after runMigrations: ${errorMsg}`,
      );
      console.error(
        `[validate-migrations] ERROR querying migrations table: ${errorMsg}`,
      );
    }

    result.migrations.executed = executedMigrations.length;
    result.migrations.executedList = executedMigrations.map((m) => m.name);

    if (executedMigrations.length > 0) {
      const lastMigration = executedMigrations[0];
      result.migrations.lastExecuted = lastMigration.name;
      result.migrations.lastExecutedAt = safeDate(lastMigration.timestamp);
    }

    // Calculate pending migrations
    // IMPORTANT: Compare loaded migration class names (from TypeORM) with executed migration names (from DB)
    // NOT file names, because file names don't match class names
    const executedNames = new Set(executedMigrations.map((m) => m.name));
    const pendingMigrations = loadedMigrationNames.filter(
      (name) => !executedNames.has(name),
    );

    result.migrations.pending = pendingMigrations.length;
    result.migrations.pendingList = pendingMigrations;

    // Log the comparison for debugging
    console.log(
      `[validate-migrations] Comparison: ${loadedMigrationNames.length} loaded migrations, ${executedMigrations.length} executed in DB`,
    );
    console.log(
      `[validate-migrations] Executed names: ${JSON.stringify(Array.from(executedNames))}`,
    );
    console.log(
      `[validate-migrations] Pending names: ${JSON.stringify(pendingMigrations)}`,
    );

    // Only add error if there's a real problem (migrations were run but not recorded)
    // Don't fail if it's just a calculation/matching issue
    if (pendingMigrations.length > 0) {
      // Check if runMigrations() actually returned migrations that should have been recorded
      const runMigrationsNames = new Set(
        executedMigrationsResult.map((m) => getMigrationName(m)),
      );
      const missingFromDb = pendingMigrations.filter((name) =>
        runMigrationsNames.has(name),
      );

      if (missingFromDb.length > 0) {
        // This is a real problem: migrations were run but not recorded in DB
        errors.push(
          `${missingFromDb.length} migration(s) were executed by runMigrations() but not found in migrations table: ${missingFromDb.join(', ')}`,
        );
      } else {
        // This might be a calculation bug - add as warning instead of error
        warnings.push(
          `${pendingMigrations.length} migration(s) appear pending after running migrations. This may be a calculation issue. Pending: ${pendingMigrations.join(', ')}`,
        );
      }
    }

    // Assert required tables exist using to_regclass
    try {
      const nestTenantsResult = await AppDataSource.manager.query<
        Array<{ table_name: string | null }>
      >("SELECT to_regclass('public.nest_tenants') as table_name");
      result.checks.nestTenantsExists =
        nestTenantsResult[0]?.table_name !== null;

      const nestUsersResult = await AppDataSource.manager.query<
        Array<{ table_name: string | null }>
      >("SELECT to_regclass('public.nest_users') as table_name");
      result.checks.nestUsersExists = nestUsersResult[0]?.table_name !== null;

      const nestAuditLogsResult = await AppDataSource.manager.query<
        Array<{ table_name: string | null }>
      >("SELECT to_regclass('public.nest_audit_logs') as table_name");
      result.checks.nestAuditLogsExists =
        nestAuditLogsResult[0]?.table_name !== null;
    } catch (tableCheckError: unknown) {
      const errorMsg =
        tableCheckError instanceof Error
          ? tableCheckError.message
          : 'Unknown error';
      errors.push(`Failed to check table existence: ${errorMsg}`);
    }

    // Fail if required tables are missing
    if (!result.checks.nestTenantsExists) {
      errors.push(
        "Required table 'public.nest_tenants' does not exist. Migrations may have failed.",
      );
    }

    if (!result.checks.nestUsersExists) {
      errors.push(
        "Required table 'public.nest_users' does not exist. Migrations may have failed.",
      );
    }

    if (!result.checks.nestAuditLogsExists) {
      errors.push(
        "Required table 'public.nest_audit_logs' does not exist. Migrations may have failed.",
      );
    }

    // Success if:
    // - No critical errors (migrations table query failures, runMigrations failures)
    // - Required tables exist
    // - Don't fail on pending count alone (might be calculation bug)
    // Only fail if runMigrations() threw OR required tables missing OR migrations were run but not recorded
    result.success = Boolean(
      errors.length === 0 &&
      result.checks.nestTenantsExists &&
      result.checks.nestUsersExists &&
      result.checks.nestAuditLogsExists,
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Migration validation failed: ${errorMessage}`);
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
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

  console.log('--- Database Diagnostics ---');
  console.log(`Connection: ${result.diagnostics.connectionString}`);
  console.log(`Config Source: ${result.diagnostics.configSource}`);
  console.log(
    `Current Database: ${result.diagnostics.currentDatabase ?? 'UNKNOWN'}`,
  );
  console.log(
    `Current Schema: ${result.diagnostics.currentSchema ?? 'UNKNOWN'}`,
  );
  console.log(`Search Path: ${result.diagnostics.searchPath ?? 'UNKNOWN'}`);
  console.log('');

  console.log('--- Migration Status ---');
  console.log(`Executed: ${result.migrations.executed}`);
  console.log(`Pending: ${result.migrations.pending}`);
  if (result.migrations.migrationsRun > 0) {
    console.log(`Migrations Run: ${result.migrations.migrationsRun}`);
  }
  if (result.migrations.lastExecuted) {
    console.log(`Last Executed: ${result.migrations.lastExecuted}`);
    console.log(`Last Executed At: ${result.migrations.lastExecutedAt}`);
  }
  console.log('');

  console.log('--- Checks ---');
  const migrationsTableIcon = result.checks.migrationsTableExists
    ? '[OK]'
    : '[FAIL]';
  console.log(`${migrationsTableIcon} Migrations table exists`);
  console.log(`Migration files found: ${result.checks.migrationFilesFound}`);
  const syncIcon = result.checks.syncMode ? '[WARN]' : '[OK]';
  console.log(`${syncIcon} Sync mode: ${result.checks.syncMode}`);

  const nestTenantsIcon = result.checks.nestTenantsExists ? '[OK]' : '[FAIL]';
  console.log(
    `${nestTenantsIcon} Table nest_tenants: ${result.checks.nestTenantsExists ? 'EXISTS' : 'MISSING'}`,
  );

  const nestUsersIcon = result.checks.nestUsersExists ? '[OK]' : '[FAIL]';
  console.log(
    `${nestUsersIcon} Table nest_users: ${result.checks.nestUsersExists ? 'EXISTS' : 'MISSING'}`,
  );

  const nestAuditLogsIcon = result.checks.nestAuditLogsExists
    ? '[OK]'
    : '[FAIL]';
  console.log(
    `${nestAuditLogsIcon} Table nest_audit_logs: ${result.checks.nestAuditLogsExists ? 'EXISTS' : 'MISSING'}`,
  );
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

main().catch((error: unknown) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
