/**
 * Test Database Bootstrap Script
 *
 * SINGLE SOURCE OF TRUTH for deterministic test database setup.
 * This script runs BEFORE e2e tests in CI to ensure the database is in a known state.
 *
 * Process:
 * 1. WAIT for DB readiness (with retry/backoff, max 60s)
 * 2. RESET schema (DROP SCHEMA public CASCADE; CREATE SCHEMA public;)
 *    - Only in NODE_ENV=test or DB_TEST_RESET=true
 * 3. RUN MIGRATIONS (all migrations from src/migrations)
 * 4. SCHEMA CONTRACT (validate all entity tables exist, fail-fast if missing)
 * 5. MINIMUM SEED (demo tenant + demo admin user, idempotent)
 * 6. CLEAN SHUTDOWN
 *
 * IMPORTANT:
 * - DB_SYNC is ALWAYS disabled (must use migrations)
 * - Uses canonical AppDataSource from data-source.ts
 * - Prints diagnostics proving same DB/schema/search_path
 * - Masks passwords in logs
 * - Exit 1 on any failure
 *
 * Usage:
 *   npm run db:test:bootstrap
 *
 * Environment variables:
 *   NODE_ENV=test (required for reset)
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME (required)
 *   DB_TEST_RESET=true (optional, forces reset even if NODE_ENV != test)
 *   DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD (optional, defaults provided)
 */

import { config } from 'dotenv';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import { AppDataSource } from '../data-source';
import { runSchemaContractCheck } from './schema-contract';
import {
  getDatabaseConnectionConfig,
  formatConnectionConfigForLogging,
} from '../config/database-config';
import { Tenant } from '../tenants/tenant.entity';
import { User, UserRole } from '../users/user.entity';

// Typed require for pg to avoid @typescript-eslint/no-unsafe-* errors
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const pg = require('pg') as typeof import('pg');
import type { Client as PgClient, ClientConfig } from 'pg';

// Load .env files (CI sets env vars directly, so this won't override)
config();

/**
 * Mask password in connection string for logging
 */
function maskPassword(str: string): string {
  return str.replace(/:([^:@]+)@/, ':***@');
}

/**
 * Safe error message extraction helper
 */
function errMsg(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

/**
 * Safe helper for pg Client operations (connect/query/end)
 * Ensures lint-safe typed operations
 */
async function withPgClient<T>(
  config: ClientConfig,
  operation: (client: PgClient) => Promise<T>,
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const client = new pg.Client(config) as PgClient;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await client.connect();
    return await operation(client);
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await client.end().catch(() => undefined);
  }
}

/**
 * Wait for database to be ready with retry/backoff
 * Max 60 seconds total
 * Does NOT initialize AppDataSource - that happens after this step
 */
async function waitForDatabase(
  maxAttempts = 30,
  delayMs = 2000,
): Promise<void> {
  console.log('[DB Bootstrap] Waiting for database to be ready...');

  // Use a temporary connection to test readiness
  const dbConfig = getDatabaseConnectionConfig();
  const clientConfig: ClientConfig = {
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await withPgClient(clientConfig, async (client) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await client.query('SELECT 1');
        console.log(
          `[DB Bootstrap] ✓ Database is ready (attempt ${attempt}/${maxAttempts})`,
        );
      });
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        console.error(
          `[DB Bootstrap] ✗ Database not ready after ${maxAttempts} attempts`,
        );
        throw new Error(`Database not ready: ${errMsg(error)}`);
      }
      console.log(
        `[DB Bootstrap] Attempt ${attempt}/${maxAttempts}: Database not ready, retrying in ${delayMs}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Print database connection diagnostics (masked)
 */
async function printDiagnostics(): Promise<void> {
  try {
    const dbConfig = getDatabaseConnectionConfig();
    const connectionString = formatConnectionConfigForLogging(dbConfig);
    const maskedConnection = maskPassword(connectionString);

    console.log('[DB Bootstrap] ========================================');
    console.log('[DB Bootstrap] Database Connection Diagnostics');
    console.log('[DB Bootstrap] ========================================');
    console.log(`[DB Bootstrap] Connection: ${maskedConnection}`);
    console.log(`[DB Bootstrap] Config Source: ${dbConfig.source}`);

    // Log path diagnostics for migration discovery debugging
    console.log(`[DB Bootstrap] Path diagnostics:`);
    console.log(`[DB Bootstrap]   __dirname: ${__dirname}`);
    console.log(`[DB Bootstrap]   process.cwd(): ${process.cwd()}`);
    const migrationsConfig = AppDataSource.options.migrations;
    const migrationsGlob = Array.isArray(migrationsConfig)
      ? migrationsConfig
      : [migrationsConfig || ''];
    console.log(
      `[DB Bootstrap]   AppDataSource.options.migrations: ${JSON.stringify(migrationsGlob)}`,
    );

    if (AppDataSource.isInitialized) {
      // Query current database
      const dbResult = await AppDataSource.manager.query<Array<{ db: string }>>(
        'SELECT current_database() as db',
      );
      const currentDatabase = dbResult[0]?.db || 'unknown';

      // Query current schema
      const schemaResult = await AppDataSource.manager.query<
        Array<{ schema: string }>
      >('SELECT current_schema() as schema');
      const currentSchema = schemaResult[0]?.schema || 'unknown';

      // Query search path
      const searchPathResult =
        await AppDataSource.manager.query<Array<{ search_path: string }>>(
          'SHOW search_path',
        );
      const searchPath = searchPathResult[0]?.search_path || 'unknown';

      console.log(`[DB Bootstrap] Current Database: ${currentDatabase}`);
      console.log(`[DB Bootstrap] Current Schema: ${currentSchema}`);
      console.log(`[DB Bootstrap] Search Path: ${searchPath}`);

      // HARD ASSERT: We must be in the expected test database
      const expectedDb = dbConfig.database;
      if (currentDatabase !== expectedDb) {
        throw new Error(
          `FATAL: Connected to wrong database! Expected: ${expectedDb}, Actual: ${currentDatabase}. ` +
            `This would cause migrations to run on the wrong database.`,
        );
      }
      console.log(
        `[DB Bootstrap] ✓ Database assertion passed: connected to ${expectedDb}`,
      );
    }

    console.log('[DB Bootstrap] ========================================');
  } catch (error) {
    console.error(
      '[DB Bootstrap] ✗ Diagnostics failed:',
      error instanceof Error ? error.message : String(error),
    );
    throw error; // Re-throw to fail bootstrap
  }
}

/**
 * Reset database schema by dropping and recreating public schema
 * Only runs in test environment or when DB_TEST_RESET=true
 */
async function resetDatabaseSchema(): Promise<void> {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const forceReset = process.env.DB_TEST_RESET === 'true';
  const shouldReset = nodeEnv === 'test' || forceReset;

  if (!shouldReset) {
    console.log(
      '[DB Bootstrap] Skipping schema reset (NODE_ENV != test and DB_TEST_RESET != true)',
    );
    return;
  }

  console.log('[DB Bootstrap] Resetting database schema...');

  // Drop and recreate public schema (CASCADE removes all objects)
  await AppDataSource.manager.query('DROP SCHEMA IF EXISTS public CASCADE;');
  await AppDataSource.manager.query('CREATE SCHEMA public;');

  // Ensure extensions are available (needed for UUID generation)
  await AppDataSource.manager.query(
    'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
  );

  console.log('[DB Bootstrap] ✓ Database schema reset complete');
}

/**
 * Run all pending migrations
 */
async function runMigrations(): Promise<void> {
  console.log('[DB Bootstrap] Running migrations...');

  // Log migrations discovery diagnostics
  const migrationsConfig = AppDataSource.options.migrations;
  const migrationsGlob = Array.isArray(migrationsConfig)
    ? migrationsConfig
    : [migrationsConfig || ''];
  console.log(
    `[DB Bootstrap] Migrations glob pattern: ${JSON.stringify(migrationsGlob)}`,
  );

  // Count migration files discovered (if possible)
  try {
    // Try to resolve actual files from glob pattern
    const migrationFiles: string[] = [];
    for (const pattern of migrationsGlob) {
      if (pattern && typeof pattern === 'string') {
        // Simple glob matching: replace * with regex
        const baseDir = pattern.includes('src/')
          ? 'src'
          : pattern.includes('dist/')
            ? 'dist'
            : '';
        const filePattern = pattern.replace(/.*\//, '').replace(/\*/g, '.*');
        const migrationsDir = path.join(process.cwd(), baseDir, 'migrations');

        if (fs.existsSync(migrationsDir)) {
          const files = fs.readdirSync(migrationsDir);
          const matchedFiles = files.filter((file: string) => {
            const regex = new RegExp(filePattern);
            return regex.test(file);
          });
          migrationFiles.push(
            ...matchedFiles.map((f: string) =>
              path.join(baseDir, 'migrations', f),
            ),
          );
        }
      }
    }
    console.log(
      `[DB Bootstrap] Migration files discovered: ${migrationFiles.length}`,
    );
    if (migrationFiles.length > 0 && migrationFiles.length <= 20) {
      console.log('[DB Bootstrap] Migration files:');
      for (const file of migrationFiles) {
        console.log(`[DB Bootstrap]   - ${file}`);
      }
    }
  } catch (error) {
    console.warn(
      '[DB Bootstrap] Could not count migration files:',
      error instanceof Error ? error.message : String(error),
    );
  }

  // Check pending migrations before running
  const pendingMigrations = await AppDataSource.showMigrations();
  console.log(
    `[DB Bootstrap] Pending migrations: ${pendingMigrations ? 'YES' : 'NO'}`,
  );

  let executedMigrations: Array<{ name: string; timestamp: number }> = [];
  try {
    executedMigrations = await AppDataSource.runMigrations();

    if (executedMigrations.length === 0) {
      console.log(
        '[DB Bootstrap] ✓ No migrations to execute (schema is up to date)',
      );
    } else {
      console.log(
        `[DB Bootstrap] ✓ Executed ${executedMigrations.length} migration(s):`,
      );
      for (const migration of executedMigrations) {
        console.log(`[DB Bootstrap]   - ${migration.name}`);
      }
    }

    // Log executed migration names list (for CI verification)
    console.log('[DB Bootstrap] Executed migrations list:');
    console.log(
      JSON.stringify(
        executedMigrations.map((m) => m.name),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error('[DB Bootstrap] ✗ Migration execution FAILED');
    console.error(
      '[DB Bootstrap] Error details:',
      error instanceof Error ? error.message : String(error),
    );
    if (error instanceof Error && error.stack) {
      console.error('[DB Bootstrap] Stack trace:', error.stack);
    }
    throw new Error(
      `Migrations failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // FAIL-FAST validation: Check critical GRC tables exist after migrations
  console.log(
    '[DB Bootstrap] Validating critical GRC tables after migrations...',
  );
  try {
    const validationResult = await AppDataSource.manager.query<
      Array<{
        db: string;
        schema: string;
        grc_requirements: string | null;
        grc_policies: string | null;
        grc_risks: string | null;
      }>
    >(`
      SELECT
        current_database() as db,
        current_schema() as schema,
        to_regclass('public.grc_requirements')::text as grc_requirements,
        to_regclass('public.grc_policies')::text as grc_policies,
        to_regclass('public.grc_risks')::text as grc_risks
    `);

    const result = validationResult[0];
    console.log('[DB Bootstrap] Critical table validation:');
    console.log(`[DB Bootstrap]   Database: ${result?.db}`);
    console.log(`[DB Bootstrap]   Schema: ${result?.schema}`);
    console.log(
      `[DB Bootstrap]   grc_requirements: ${result?.grc_requirements ?? 'NULL'}`,
    );
    console.log(
      `[DB Bootstrap]   grc_policies: ${result?.grc_policies ?? 'NULL'}`,
    );
    console.log(`[DB Bootstrap]   grc_risks: ${result?.grc_risks ?? 'NULL'}`);

    // FAIL-FAST: Exit if any critical table is missing
    if (
      !result?.grc_requirements ||
      !result?.grc_policies ||
      !result?.grc_risks
    ) {
      const missingTables: string[] = [];
      if (!result?.grc_requirements) missingTables.push('grc_requirements');
      if (!result?.grc_policies) missingTables.push('grc_policies');
      if (!result?.grc_risks) missingTables.push('grc_risks');

      console.error('[DB Bootstrap] ========================================');
      console.error('[DB Bootstrap] FATAL: Critical GRC tables are missing!');
      console.error('[DB Bootstrap] ========================================');
      console.error(
        `[DB Bootstrap] Missing tables: ${missingTables.join(', ')}`,
      );
      console.error(`[DB Bootstrap] Database: ${result?.db}`);
      console.error(`[DB Bootstrap] Schema: ${result?.schema}`);
      console.error(
        `[DB Bootstrap] Executed migrations: ${executedMigrations.length}`,
      );
      console.error('[DB Bootstrap] ========================================');
      console.error(
        '[DB Bootstrap] This indicates migrations did not create required tables.',
      );
      console.error('[DB Bootstrap] E2E tests will fail. Stopping bootstrap.');
      console.error('[DB Bootstrap] ========================================');
      process.exit(1);
    }

    console.log('[DB Bootstrap] ✓ All critical GRC tables exist');
  } catch (error) {
    console.error('[DB Bootstrap] ✗ Critical table validation FAILED');
    console.error(
      '[DB Bootstrap] Error details:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }

  // After migrations, list ALL tables in public schema
  console.log('[DB Bootstrap] Listing all tables in public schema...');
  try {
    const tablesResult = await AppDataSource.manager.query<
      Array<{ tablename: string }>
    >(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`,
    );
    const tableNames = tablesResult.map((row) => row.tablename);
    console.log(
      `[DB Bootstrap] Total tables in public schema: ${tableNames.length}`,
    );
    if (tableNames.length > 0) {
      console.log('[DB Bootstrap] Tables:');
      for (const tableName of tableNames) {
        console.log(`[DB Bootstrap]   - ${tableName}`);
      }
    } else {
      console.warn(
        '[DB Bootstrap] ⚠ WARNING: No tables found in public schema after migrations!',
      );
    }
  } catch (error) {
    console.error(
      '[DB Bootstrap] ✗ Failed to list tables:',
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}

/**
 * Validate schema contract (fail-fast if tables are missing)
 */
async function validateSchemaContract(): Promise<void> {
  console.log('[DB Bootstrap] Validating schema contract...');

  const result = await runSchemaContractCheck(
    AppDataSource,
    true,
    '[DB Bootstrap]',
  );

  if (!result.success) {
    console.error('[DB Bootstrap] ✗ Schema contract validation FAILED');

    if (result.missingTables.length > 0) {
      console.error('[DB Bootstrap] Missing tables:');
      for (const table of result.missingTables) {
        console.error(`[DB Bootstrap]   - ${table}`);
      }
    }

    if (result.missingColumns.length > 0) {
      console.error('[DB Bootstrap] Missing columns:');
      for (const missing of result.missingColumns) {
        console.error(
          `[DB Bootstrap]   - ${missing.table}: ${missing.columns.join(', ')}`,
        );
      }
    }

    if (result.errors.length > 0) {
      console.error('[DB Bootstrap] Errors:');
      for (const error of result.errors) {
        console.error(`[DB Bootstrap]   - ${error}`);
      }
    }

    throw new Error(
      'Schema contract validation failed - missing tables or columns detected',
    );
  }

  console.log('[DB Bootstrap] ✓ Schema contract validation passed');
  console.log(
    `[DB Bootstrap]   All ${result.expectedTables.length} expected table(s) exist`,
  );
}

/**
 * Seed minimum data (demo tenant + demo admin user)
 * Idempotent: if exists, update password hash, tenant link, active flag
 */
async function seedMinimumData(): Promise<void> {
  console.log('[DB Bootstrap] Seeding minimum data (demo tenant + admin)...');

  const demoAdminEmail =
    process.env.DEMO_ADMIN_EMAIL || 'admin@grc-platform.local';
  const demoAdminPassword =
    process.env.DEMO_ADMIN_PASSWORD || 'TestPassword123!';

  const tenantRepository = AppDataSource.getRepository(Tenant);
  const userRepository = AppDataSource.getRepository(User);

  // Create or get demo tenant
  let demoTenant = await tenantRepository.findOne({
    where: { name: 'Demo Organization' },
  });
  if (!demoTenant) {
    demoTenant = tenantRepository.create({
      name: 'Demo Organization',
      description: 'Default demo tenant for testing and development',
      isActive: true,
    });
    demoTenant = await tenantRepository.save(demoTenant);
    console.log(`[DB Bootstrap]   Created demo tenant: ${demoTenant.id}`);
  } else {
    // Update to ensure it's active
    demoTenant.isActive = true;
    demoTenant = await tenantRepository.save(demoTenant);
    console.log(
      `[DB Bootstrap]   Demo tenant already exists: ${demoTenant.id}`,
    );
  }

  // Create or update demo admin user
  let demoAdmin = await userRepository.findOne({
    where: { email: demoAdminEmail },
  });
  if (!demoAdmin) {
    const passwordHash = await bcrypt.hash(demoAdminPassword, 10);
    demoAdmin = userRepository.create({
      email: demoAdminEmail,
      passwordHash,
      role: UserRole.ADMIN,
      firstName: 'Demo',
      lastName: 'Admin',
      isActive: true,
      tenantId: demoTenant.id,
    });
    demoAdmin = await userRepository.save(demoAdmin);
    console.log(`[DB Bootstrap]   Created demo admin user: ${demoAdmin.id}`);
  } else {
    // Update existing user to ensure correct tenant and role
    demoAdmin.tenantId = demoTenant.id;
    demoAdmin.role = UserRole.ADMIN;
    demoAdmin.isActive = true;
    // Update password if it doesn't match
    if (
      !demoAdmin.passwordHash ||
      !(await bcrypt.compare(demoAdminPassword, demoAdmin.passwordHash))
    ) {
      demoAdmin.passwordHash = await bcrypt.hash(demoAdminPassword, 10);
    }
    demoAdmin = await userRepository.save(demoAdmin);
    console.log(`[DB Bootstrap]   Updated demo admin user: ${demoAdmin.id}`);
  }

  console.log('[DB Bootstrap] ✓ Minimum data seeded');
  console.log(
    `[DB Bootstrap]   Demo tenant: ${demoTenant.id} (${demoTenant.name})`,
  );
  console.log(
    `[DB Bootstrap]   Demo admin: ${demoAdmin.id} (${demoAdmin.email})`,
  );
}

/**
 * Main bootstrap function
 */
async function bootstrap(): Promise<void> {
  // Ensure DB_SYNC is disabled
  process.env.DB_SYNC = 'false';

  // Ensure NODE_ENV is set to test
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test';
  }

  try {
    console.log('[DB Bootstrap] ========================================');
    console.log('[DB Bootstrap] Starting deterministic database bootstrap');
    console.log('[DB Bootstrap] ========================================');

    // Step 1: Wait for database readiness
    console.log('[DB Bootstrap] Step 1/7: Waiting for database readiness...');
    await waitForDatabase();

    // Step 2: Initialize AppDataSource
    console.log('[DB Bootstrap] Step 2/7: Initializing AppDataSource...');
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    // Step 3: Print diagnostics
    console.log('[DB Bootstrap] Step 3/7: Printing connection diagnostics...');
    await printDiagnostics();

    // Step 4: Reset database schema (test env only)
    console.log('[DB Bootstrap] Step 4/7: Resetting database schema...');
    await resetDatabaseSchema();

    // Step 5: Run migrations
    console.log('[DB Bootstrap] Step 5/7: Running migrations...');
    await runMigrations();

    // Step 6: Validate schema contract (fail-fast)
    console.log('[DB Bootstrap] Step 6/7: Validating schema contract...');
    await validateSchemaContract();

    // Step 7: Seed minimum data
    console.log('[DB Bootstrap] Step 7/7: Seeding minimum data...');
    await seedMinimumData();

    console.log('[DB Bootstrap] ========================================');
    console.log('[DB Bootstrap] ✓ Database bootstrap complete');
    console.log('[DB Bootstrap] ========================================');

    // Clean shutdown
    console.log('[DB Bootstrap] Closing database connection...');
    await AppDataSource.destroy();
    console.log('[DB Bootstrap] ✓ Bootstrap complete');
  } catch (error) {
    console.error('[DB Bootstrap] ✗ Error during bootstrap:');
    if (error instanceof Error) {
      console.error(`[DB Bootstrap]   ${error.message}`);
      if (error.stack) {
        console.error(`[DB Bootstrap] Stack trace:\n${error.stack}`);
      }
    } else {
      console.error('[DB Bootstrap]   Unknown error:', error);
    }

    // Clean up connection if it was initialized
    if (AppDataSource.isInitialized) {
      try {
        await AppDataSource.destroy();
      } catch (destroyError) {
        console.error(
          '[DB Bootstrap] Error destroying connection:',
          destroyError,
        );
      }
    }

    // Exit with error code
    process.exit(1);
  }
}

// Run bootstrap
bootstrap().catch((error) => {
  console.error('[DB Bootstrap] Fatal error:', error);
  process.exit(1);
});
