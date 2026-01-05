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

import { DataSource } from 'typeorm';

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
      'Schema contract: entity metadata is empty. Entity discovery is broken (check AppDataSource.options.entities).',
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
 * @deprecated Use runSchemaContractCheckWithDataSource instead - migrations must be run separately before schema contract check
 * @param dataSource - TypeORM DataSource (must be initialized)
 * @param skipMigrations - DEPRECATED: Always true. Migrations must be run separately.
 * @param logPrefix - Prefix for log messages (default: '[schema-contract]')
 */
export async function runSchemaContractCheck(
  dataSource: DataSource,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  skipMigrations = true,
  logPrefix = '[schema-contract]',
): Promise<SchemaContractResult> {
  // NOTE: This function no longer runs migrations. Migrations must be run separately.
  // This ensures deterministic behavior and prevents duplicate migration execution in CI/test bootstrap flows.
  return await runSchemaContractCheckWithDataSource(dataSource, logPrefix);
}
