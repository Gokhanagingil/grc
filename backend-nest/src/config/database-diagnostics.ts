/**
 * Database Connection Diagnostics
 *
 * Provides diagnostic functions to verify database connection configuration
 * and verify that expected tables exist in the correct database/schema.
 *
 * This is used at application startup to detect connection mismatches early.
 */

import { DataSource } from 'typeorm';
import {
  getDatabaseConnectionConfig,
  formatConnectionConfigForLogging,
} from './database-config';

import { ConfigSource } from './database-config';

export interface DatabaseDiagnostics {
  connectionString: string;
  configSource: ConfigSource;
  currentDatabase: string | null;
  currentSchema: string | null;
  searchPath: string | null;
  nestUsersExists: boolean;
  nestAuditLogsExists: boolean;
}

/**
 * Run database connection diagnostics
 *
 * Executes queries to verify:
 * - Current database name
 * - Current schema
 * - Search path
 * - Existence of expected tables (nest_users, nest_audit_logs)
 *
 * @param dataSource - Initialized TypeORM DataSource
 * @returns Diagnostic information
 */
export async function runDatabaseDiagnostics(
  dataSource: DataSource,
): Promise<DatabaseDiagnostics> {
  const dbConfig = getDatabaseConnectionConfig();
  const connectionString = formatConnectionConfigForLogging(dbConfig);

  let currentDatabase: string | null = null;
  let currentSchema: string | null = null;
  let searchPath: string | null = null;
  let nestUsersExists = false;
  let nestAuditLogsExists = false;

  try {
    // Query current database
    const dbResult = await dataSource.manager.query<Array<{ db: string }>>(
      'SELECT current_database() as db',
    );
    currentDatabase = dbResult[0]?.db || null;

    // Query current schema
    const schemaResult = await dataSource.manager.query<
      Array<{ schema: string }>
    >('SELECT current_schema() as schema');
    currentSchema = schemaResult[0]?.schema || null;

    // Query search path
    const searchPathResult =
      await dataSource.manager.query<Array<{ search_path: string }>>(
        'SHOW search_path',
      );
    searchPath = searchPathResult[0]?.search_path || null;

    // Check if nest_users table exists
    const nestUsersResult = await dataSource.manager.query<
      Array<{ table_name: string | null }>
    >("SELECT to_regclass('public.nest_users') as table_name");
    nestUsersExists = nestUsersResult[0]?.table_name !== null;

    // Check if nest_audit_logs table exists
    const nestAuditLogsResult = await dataSource.manager.query<
      Array<{ table_name: string | null }>
    >("SELECT to_regclass('public.nest_audit_logs') as table_name");
    nestAuditLogsExists = nestAuditLogsResult[0]?.table_name !== null;
  } catch (error) {
    // If diagnostics fail, log the error but don't throw
    // This allows the app to continue starting if there's a query issue
    console.error('[Database Diagnostics] Error running diagnostics:', error);
  }

  return {
    connectionString,
    configSource: dbConfig.source,
    currentDatabase,
    currentSchema,
    searchPath,
    nestUsersExists,
    nestAuditLogsExists,
  };
}

/**
 * Format diagnostics for logging
 *
 * @param diagnostics - Diagnostic information
 * @returns Formatted log message
 */
export function formatDiagnosticsForLogging(
  diagnostics: DatabaseDiagnostics,
): string {
  const lines = [
    '=== Database Connection Diagnostics ===',
    `Connection: ${diagnostics.connectionString}`,
    `Config Source: ${diagnostics.configSource}`,
    `Current Database: ${diagnostics.currentDatabase ?? 'UNKNOWN'}`,
    `Current Schema: ${diagnostics.currentSchema ?? 'UNKNOWN'}`,
    `Search Path: ${diagnostics.searchPath ?? 'UNKNOWN'}`,
    `Table nest_users: ${diagnostics.nestUsersExists ? 'EXISTS' : 'MISSING'}`,
    `Table nest_audit_logs: ${diagnostics.nestAuditLogsExists ? 'EXISTS' : 'MISSING'}`,
    '======================================',
  ];

  return lines.join('\n');
}
