/**
 * Database Validation Script
 *
 * Validates database connectivity, checks connection pool health,
 * and verifies basic query execution. Supports JSON output for CI.
 *
 * Usage:
 *   npm run validate:db           - Human-readable output
 *   npm run validate:db -- --json - JSON output for CI
 *
 * Exit codes:
 *   0 - Database connection successful
 *   1 - Database connection failed
 */

import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

interface ValidationResult {
  success: boolean;
  timestamp: string;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
  };
  checks: {
    connection: {
      status: 'ok' | 'failed';
      responseTimeMs: number;
      error?: string;
    };
    query: {
      status: 'ok' | 'failed';
      responseTimeMs: number;
      error?: string;
    };
    tables: {
      status: 'ok' | 'failed';
      count: number;
      error?: string;
    };
  };
  errors: string[];
  warnings: string[];
}

async function validateDatabase(): Promise<ValidationResult> {
  const timestamp = new Date().toISOString();
  const errors: string[] = [];
  const warnings: string[] = [];

  const dbConfig = {
    host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(
      process.env.DB_PORT || process.env.POSTGRES_PORT || '5432',
      10,
    ),
    name: process.env.DB_NAME || process.env.POSTGRES_DB || 'grc_platform',
    user: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
  };

  const result: ValidationResult = {
    success: false,
    timestamp,
    database: dbConfig,
    checks: {
      connection: { status: 'failed', responseTimeMs: 0 },
      query: { status: 'failed', responseTimeMs: 0 },
      tables: { status: 'failed', count: 0 },
    },
    errors,
    warnings,
  };

  const dataSource = new DataSource({
    type: 'postgres',
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.user,
    password:
      process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
    database: dbConfig.name,
    connectTimeoutMS: 10000,
  });

  try {
    // Check 1: Connection
    const connStart = Date.now();
    await dataSource.initialize();
    result.checks.connection = {
      status: 'ok',
      responseTimeMs: Date.now() - connStart,
    };

    // Check 2: Simple query
    const queryStart = Date.now();
    await dataSource.query('SELECT 1 as test');
    result.checks.query = {
      status: 'ok',
      responseTimeMs: Date.now() - queryStart,
    };

    // Check 3: Table count
    try {
      const tablesResult: Array<{ count: string }> = await dataSource.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      const tableCount = parseInt(tablesResult[0]?.count || '0', 10);
      result.checks.tables = {
        status: 'ok',
        count: tableCount,
      };

      if (tableCount === 0) {
        warnings.push(
          'No tables found in public schema. Database may need migrations.',
        );
      }
    } catch (tableError) {
      result.checks.tables = {
        status: 'failed',
        count: 0,
        error:
          tableError instanceof Error ? tableError.message : 'Unknown error',
      };
      warnings.push('Could not count tables: ' + result.checks.tables.error);
    }

    // Check response times
    if (result.checks.connection.responseTimeMs > 5000) {
      warnings.push(
        `Connection time is slow: ${result.checks.connection.responseTimeMs}ms`,
      );
    }
    if (result.checks.query.responseTimeMs > 1000) {
      warnings.push(
        `Query time is slow: ${result.checks.query.responseTimeMs}ms`,
      );
    }

    result.success = true;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Database connection failed: ${errorMessage}`);
    result.checks.connection = {
      status: 'failed',
      responseTimeMs: 0,
      error: errorMessage,
    };
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }

  return result;
}

function printHumanReadable(result: ValidationResult): void {
  console.log('========================================');
  console.log('Database Validation');
  console.log('========================================');
  console.log(`Timestamp: ${result.timestamp}`);
  console.log('');

  console.log('--- Database Configuration ---');
  console.log(`Host: ${result.database.host}`);
  console.log(`Port: ${result.database.port}`);
  console.log(`Database: ${result.database.name}`);
  console.log(`User: ${result.database.user}`);
  console.log('');

  console.log('--- Connection Check ---');
  const connIcon = result.checks.connection.status === 'ok' ? '[OK]' : '[FAIL]';
  console.log(
    `${connIcon} Connection: ${result.checks.connection.responseTimeMs}ms`,
  );
  if (result.checks.connection.error) {
    console.log(`    Error: ${result.checks.connection.error}`);
  }

  console.log('--- Query Check ---');
  const queryIcon = result.checks.query.status === 'ok' ? '[OK]' : '[FAIL]';
  console.log(`${queryIcon} Query: ${result.checks.query.responseTimeMs}ms`);
  if (result.checks.query.error) {
    console.log(`    Error: ${result.checks.query.error}`);
  }

  console.log('--- Tables Check ---');
  const tablesIcon = result.checks.tables.status === 'ok' ? '[OK]' : '[FAIL]';
  console.log(`${tablesIcon} Tables: ${result.checks.tables.count} found`);
  if (result.checks.tables.error) {
    console.log(`    Error: ${result.checks.tables.error}`);
  }
  console.log('');

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
    console.log('[SUCCESS] Database validation passed');
  } else {
    console.log('[FAILED] Database validation failed');
  }
  console.log('========================================');
}

function printJson(result: ValidationResult): void {
  console.log(JSON.stringify(result, null, 2));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');

  const result = await validateDatabase();

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
