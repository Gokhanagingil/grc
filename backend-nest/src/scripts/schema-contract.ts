/**
 * Schema Contract Validation Script
 *
 * Validates that all expected database tables (from entity metadata) exist in the database.
 * This provides a fail-fast gate to catch missing migrations early in CI.
 *
 * Process:
 * 1. Initialize AppDataSource (canonical config)
 * 2. Run migrations idempotently (ensure schema is up to date)
 * 3. Read expected table names from AppDataSource.entityMetadatas (tableName)
 * 4. Read actual tables from pg_tables (public schema)
 * 5. Diff and print MissingTables (and optionally MissingColumns)
 * 6. Exit 1 if anything missing, with clear list output
 *
 * Usage:
 *   npm run schema:contract
 *
 * Exit codes:
 *   0 - All expected tables exist
 *   1 - Missing tables or columns detected
 */

import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { AppDataSource } from '../data-source';

config();

/**
 * Schema Contract Result Interface
 * Export for reuse in other modules (e.g., globalSetup.ts)
 */
export interface SchemaContractResult {
  success: boolean;
  timestamp: string;
  expectedTables: string[];
  actualTables: string[];
  missingTables: string[];
  missingColumns: Array<{ table: string; columns: string[] }>;
  errors: string[];
}

/**
 * Get expected table names from entity metadata
 * Export for reuse
 */
export function getExpectedTables(dataSource: DataSource): string[] {
  if (!dataSource.isInitialized) {
    throw new Error(
      'DataSource must be initialized before getting entity metadata',
    );
  }

  const entityMetadatas = dataSource.entityMetadatas;
  const tableNames = new Set<string>();

  for (const metadata of entityMetadatas) {
    if (metadata.tableName) {
      tableNames.add(metadata.tableName);
    }
  }

  return Array.from(tableNames).sort();
}

/**
 * Get actual table names from PostgreSQL
 * Export for reuse
 */
export async function getActualTables(
  dataSource: DataSource,
): Promise<string[]> {
  if (!dataSource.isInitialized) {
    throw new Error('DataSource must be initialized before querying tables');
  }

  const result = await dataSource.manager.query<Array<{ table_name: string }>>(
    `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
    `,
  );

  return result.map((row) => row.table_name);
}

/**
 * Get expected columns for a table from entity metadata
 * Export for reuse
 */
export function getExpectedColumns(
  dataSource: DataSource,
  tableName: string,
): string[] {
  if (!dataSource.isInitialized) {
    throw new Error(
      'DataSource must be initialized before getting column metadata',
    );
  }

  const entityMetadata = dataSource.entityMetadatas.find(
    (meta) => meta.tableName === tableName,
  );

  if (!entityMetadata) {
    return [];
  }

  const columns = new Set<string>();
  for (const column of entityMetadata.columns) {
    if (column.databaseName) {
      columns.add(column.databaseName);
    }
  }

  return Array.from(columns).sort();
}

/**
 * Get actual columns for a table from PostgreSQL
 * Export for reuse
 */
export async function getActualColumns(
  dataSource: DataSource,
  tableName: string,
): Promise<string[]> {
  if (!dataSource.isInitialized) {
    throw new Error('DataSource must be initialized before querying columns');
  }

  const result = await dataSource.manager.query<Array<{ column_name: string }>>(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    ORDER BY column_name
    `,
    [tableName],
  );

  return result.map((row) => row.column_name);
}

/**
 * Validate schema contract with an existing DataSource (core function)
 *
 * This is the core validation function that does NOT initialize DataSource or run migrations.
 * It assumes the DataSource is already initialized and migrations have already been run.
 *
 * @param dataSource - TypeORM DataSource (must be initialized)
 * @param logPrefix - Prefix for log messages (default: '[schema-contract]')
 * @returns SchemaContractResult with validation results
 * @throws Error if DataSource is not initialized or entity metadata is empty
 */
export async function runSchemaContractCheckWithDataSource(
  dataSource: DataSource,
  logPrefix = '[schema-contract]',
): Promise<SchemaContractResult> {
  const timestamp = new Date().toISOString();
  const result: SchemaContractResult = {
    success: false,
    timestamp,
    expectedTables: [],
    actualTables: [],
    missingTables: [],
    missingColumns: [],
    errors: [],
  };

  if (!dataSource.isInitialized) {
    throw new Error(
      'DataSource must be initialized before running schema contract check',
    );
  }

  // FAIL-FAST: Entity metadata must not be empty
  const entityMetadatas = dataSource.entityMetadatas;
  if (entityMetadatas.length === 0) {
    throw new Error(
      'Entity metadata empty - wrong DataSource/entities glob. ' +
        'Expected tables cannot be determined from empty entity metadata.',
    );
  }

  // Get expected tables from entity metadata
  console.log(`${logPrefix} Reading expected tables from entity metadata...`);
  result.expectedTables = getExpectedTables(dataSource);
  console.log(
    `${logPrefix} Found ${result.expectedTables.length} expected table(s)`,
  );

  // Get actual tables from database
  console.log(`${logPrefix} Reading actual tables from database...`);
  result.actualTables = await getActualTables(dataSource);
  console.log(
    `${logPrefix} Found ${result.actualTables.length} actual table(s)`,
  );

  // Find missing tables
  const actualTableSet = new Set(result.actualTables);
  result.missingTables = result.expectedTables.filter(
    (table) => !actualTableSet.has(table),
  );

  // Check for missing columns (optional, but helpful)
  if (result.missingTables.length === 0) {
    console.log(`${logPrefix} Checking columns for existing tables...`);
    for (const tableName of result.expectedTables) {
      const expectedColumns = getExpectedColumns(dataSource, tableName);
      const actualColumns = await getActualColumns(dataSource, tableName);
      const actualColumnSet = new Set(actualColumns);

      const missingCols = expectedColumns.filter(
        (col) => !actualColumnSet.has(col),
      );
      if (missingCols.length > 0) {
        result.missingColumns.push({
          table: tableName,
          columns: missingCols,
        });
      }
    }
  }

  // Success if no missing tables or columns
  result.success =
    result.missingTables.length === 0 && result.missingColumns.length === 0;

  return result;
}

/**
 * Validate schema contract (legacy function - kept for backward compatibility)
 * Can be called with an already-initialized DataSource
 *
 * @deprecated Use runSchemaContractCheckWithDataSource instead - this function includes migration logic that should be handled separately
 * @param dataSource - TypeORM DataSource (must be initialized)
 * @param skipMigrations - If true, skip running migrations (assumes they're already run)
 * @param logPrefix - Prefix for log messages (default: '[schema-contract]')
 */
export async function runSchemaContractCheck(
  dataSource: DataSource,
  skipMigrations = true,
  logPrefix = '[schema-contract]',
): Promise<SchemaContractResult> {
  try {
    if (!dataSource.isInitialized) {
      throw new Error(
        'DataSource must be initialized before running schema contract check',
      );
    }

    // Run migrations idempotently (unless skipped - default is now true)
    if (!skipMigrations) {
      console.log(`${logPrefix} Running migrations (idempotent)...`);
      const pendingMigrations = await dataSource.showMigrations();
      if (pendingMigrations) {
        const executedMigrations = await dataSource.runMigrations();
        if (executedMigrations.length > 0) {
          console.log(
            `${logPrefix} ✓ Executed ${executedMigrations.length} pending migration(s)`,
          );
        }
      } else {
        console.log(`${logPrefix} ✓ No pending migrations`);
      }
    }

    // Use the core function for validation
    return await runSchemaContractCheckWithDataSource(dataSource, logPrefix);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const result: SchemaContractResult = {
      success: false,
      timestamp: new Date().toISOString(),
      expectedTables: [],
      actualTables: [],
      missingTables: [],
      missingColumns: [],
      errors: [`Schema contract validation failed: ${errorMessage}`],
    };
    if (error instanceof Error && error.stack) {
      console.error(`${logPrefix} Stack trace:`, error.stack);
    }
    return result;
  }
}

/**
 * Validate schema contract (CLI wrapper - initializes and destroys DataSource)
 *
 * NOTE: This CLI wrapper does NOT run migrations. Migrations should be run separately
 * before calling schema contract validation. This ensures deterministic behavior
 * and prevents double initialization issues in CI/test bootstrap flows.
 */
async function validateSchemaContract(): Promise<SchemaContractResult> {
  try {
    // Initialize AppDataSource
    console.log('[schema-contract] Initializing AppDataSource...');
    await AppDataSource.initialize();

    // Run schema contract check (WITHOUT migrations - migrations should be run separately)
    const result = await runSchemaContractCheckWithDataSource(
      AppDataSource,
      '[schema-contract]',
    );

    return result;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

/**
 * Print human-readable output
 */
function printResult(result: SchemaContractResult): void {
  console.log('');
  console.log('========================================');
  console.log('Schema Contract Validation');
  console.log('========================================');
  console.log(`Timestamp: ${result.timestamp}`);
  console.log('');

  console.log('--- Expected Tables ---');
  console.log(`Total: ${result.expectedTables.length}`);
  if (result.expectedTables.length > 0) {
    for (const table of result.expectedTables) {
      console.log(`  ✓ ${table}`);
    }
  }
  console.log('');

  if (result.missingTables.length > 0) {
    console.log('--- MISSING TABLES ---');
    for (const table of result.missingTables) {
      console.log(`  ✗ ${table}`);
    }
    console.log('');
  }

  if (result.missingColumns.length > 0) {
    console.log('--- MISSING COLUMNS ---');
    for (const missing of result.missingColumns) {
      console.log(`  ✗ ${missing.table}:`);
      for (const column of missing.columns) {
        console.log(`      - ${column}`);
      }
    }
    console.log('');
  }

  if (result.errors.length > 0) {
    console.log('--- ERRORS ---');
    for (const error of result.errors) {
      console.log(`  ✗ ${error}`);
    }
    console.log('');
  }

  console.log('========================================');
  if (result.success) {
    console.log('[SUCCESS] Schema contract validation passed');
    console.log(`All ${result.expectedTables.length} expected table(s) exist`);
  } else {
    console.log('[FAILED] Schema contract validation failed');
    if (result.missingTables.length > 0) {
      console.log(`Missing ${result.missingTables.length} table(s):`);
      for (const table of result.missingTables) {
        console.log(`  - ${table}`);
      }
    }
    if (result.missingColumns.length > 0) {
      console.log(
        `Missing columns in ${result.missingColumns.length} table(s)`,
      );
    }
  }
  console.log('========================================');
  console.log('');
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const result = await validateSchemaContract();
  printResult(result);
  process.exit(result.success ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error('[schema-contract] Unexpected error:', error);
  process.exit(1);
});
