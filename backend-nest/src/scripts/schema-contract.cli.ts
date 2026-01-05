/**
 * Schema Contract CLI Entry Point
 *
 * This is a separate CLI file that initializes AppDataSource and runs schema contract validation.
 * The main schema-contract.ts file is now a pure library with no side effects.
 *
 * Usage:
 *   npm run schema:contract
 *
 * Exit codes:
 *   0 - All expected tables exist
 *   1 - Missing tables or columns detected
 */

import { config } from 'dotenv';
import { AppDataSource } from '../data-source';
import {
  runSchemaContractCheckWithDataSource,
  type SchemaContractResult,
} from './schema-contract';

config();

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
 * Main function (CLI entry point)
 */
async function main(): Promise<void> {
  try {
    // Initialize AppDataSource
    console.log('[schema-contract] Initializing AppDataSource...');
    await AppDataSource.initialize();

    // Run schema contract check (migrations should be run separately before this)
    const result = await runSchemaContractCheckWithDataSource(
      AppDataSource,
      '[schema-contract]',
    );

    printResult(result);
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('[schema-contract] Error:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

// Run main
void main();
