/**
 * Migrations Table Name Resolver
 *
 * Provides a shared function to resolve the correct migrations table name
 * used by TypeORM. This ensures consistency across:
 * - Migration status scripts (migrations-status.ts, migration-status.ts)
 * - Migration run scripts (migration-run.ts)
 * - Health check service (health.service.ts)
 *
 * Resolution priority:
 * 1. dataSource.options.migrationsTableName (if explicitly configured)
 * 2. Database detection: prefer 'typeorm_migrations' if it exists
 * 3. Fall back to 'migrations' if it exists
 * 4. Default to 'migrations' with a warning if neither exists
 *
 * This handles the staging mismatch where:
 * - Old 'migrations' table has 4 rows (legacy)
 * - New 'typeorm_migrations' table has 13 rows (correct, current)
 */

import { DataSource } from 'typeorm';

export interface MigrationsTableResolution {
  tableName: string;
  source:
    | 'config'
    | 'detected_typeorm_migrations'
    | 'detected_migrations'
    | 'default';
  warning?: string;
}

/**
 * Check if a table exists in the public schema
 *
 * @param dataSource - Initialized TypeORM DataSource
 * @param tableName - Name of the table to check
 * @returns true if the table exists, false otherwise
 */
async function tableExists(
  dataSource: DataSource,
  tableName: string,
): Promise<boolean> {
  try {
    const result: unknown = await dataSource.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`,
      [tableName],
    );

    if (Array.isArray(result) && result.length > 0) {
      const row = result[0] as { exists?: boolean };
      return row.exists === true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Resolve the migrations table name from a DataSource
 *
 * This function determines which migrations table to use based on:
 * 1. Explicit configuration in dataSource.options.migrationsTableName
 * 2. Database detection (prefers typeorm_migrations over migrations)
 * 3. Default fallback to 'migrations'
 *
 * @param dataSource - Initialized TypeORM DataSource
 * @returns Resolution result with table name, source, and optional warning
 */
export async function resolveMigrationsTableName(
  dataSource: DataSource,
): Promise<MigrationsTableResolution> {
  // Priority 1: Use explicitly configured table name from DataSource options
  const configuredTableName = dataSource.options.migrationsTableName;
  if (configuredTableName && typeof configuredTableName === 'string') {
    return {
      tableName: configuredTableName,
      source: 'config',
    };
  }

  // Priority 2: Detect which table exists in the database
  // Prefer 'typeorm_migrations' (the newer, correct table) over 'migrations' (legacy)
  const typeormMigrationsExists = await tableExists(
    dataSource,
    'typeorm_migrations',
  );
  if (typeormMigrationsExists) {
    return {
      tableName: 'typeorm_migrations',
      source: 'detected_typeorm_migrations',
    };
  }

  const migrationsExists = await tableExists(dataSource, 'migrations');
  if (migrationsExists) {
    return {
      tableName: 'migrations',
      source: 'detected_migrations',
    };
  }

  // Priority 3: Default to 'migrations' with a warning
  return {
    tableName: 'migrations',
    source: 'default',
    warning:
      'Neither typeorm_migrations nor migrations table exists. ' +
      'Using default table name "migrations". ' +
      'Run migrations first: npm run migration:run',
  };
}

/**
 * Get the migrations table name synchronously from DataSource options
 *
 * This is a simpler version that only checks the DataSource configuration
 * without querying the database. Useful when you don't need database detection.
 *
 * @param dataSource - TypeORM DataSource (doesn't need to be initialized)
 * @returns The configured migrations table name or 'migrations' as default
 */
export function getMigrationsTableNameFromConfig(
  dataSource: DataSource,
): string {
  const configuredTableName = dataSource.options.migrationsTableName;
  if (configuredTableName && typeof configuredTableName === 'string') {
    return configuredTableName;
  }
  return 'migrations';
}
