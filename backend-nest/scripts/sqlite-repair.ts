#!/usr/bin/env ts-node
/**
 * PHASE 1: SQLite Repair Script
 * 
 * Safe, idempotent runtime fixes for SQLite schema issues.
 * 
 * This script:
 * - Detects and cleans up bad temp tables (e.g. temporary_policies, policies_tmp)
 * - Detects missing columns and adds them via ALTER TABLE (NULL allowed)
 * - Fixes NOT NULL violations by populating safe defaults
 * - Fixes name/title/titleDb mismatches
 * - Ensures tenant_id always exists and is populated
 * 
 * CRITICAL:
 * - Do NOT drop tables
 * - Do NOT rewrite schema
 * - Do NOT affect migrations folder
 * - Only safe, idempotent ALTER TABLE operations
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/sqlite-repair.ts
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions, ColumnType } from 'typeorm';
import * as path from 'path';
import { dbConfigFactory } from '../src/config/database.config';

// Use sqlite3 with promisify for better async handling
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface RepairAction {
  type: 'drop_temp_table' | 'add_column' | 'populate_default' | 'fix_tenant_id' | 'fix_name_title';
  table: string;
  description: string;
  sql: string;
}

async function getAllTables(dataSource: DataSource): Promise<string[]> {
  const queryRunner = dataSource.createQueryRunner();
  try {
    const result = await queryRunner.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    return result.map((row: any) => row.name);
  } finally {
    await queryRunner.release();
  }
}

async function getTableInfo(dataSource: DataSource, tableName: string): Promise<ColumnInfo[]> {
  const queryRunner = dataSource.createQueryRunner();
  try {
    const result = await queryRunner.query(`PRAGMA table_info(${tableName})`);
    return result as ColumnInfo[];
  } catch (error: any) {
    return [];
  } finally {
    await queryRunner.release();
  }
}

async function executeSql(dataSource: DataSource, sql: string, description: string): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();
  try {
    console.log(`  🔧 ${description}`);
    await queryRunner.query(sql);
    console.log(`     ✅ Success`);
  } catch (error: any) {
    // Ignore "duplicate column" errors (idempotency)
    if (error.message?.includes('duplicate column') || error.message?.includes('already exists')) {
      console.log(`     ⚠️  Already applied (idempotent)`);
    } else {
      console.error(`     ❌ Error: ${error.message}`);
      throw error;
    }
  } finally {
    await queryRunner.release();
  }
}

function getDefaultTenantId(): string {
  return process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
}

function normalizeColumnType(type: ColumnType | undefined): string {
  if (!type) return 'text';

  if (typeof type === 'string') {
    return type.toLowerCase();
  }

  // Handle common constructor types
  if (type === String) return 'text';
  if (type === Number) return 'integer';
  // Check for BigInt by comparing constructor name (safer than direct comparison)
  if (typeof BigInt !== 'undefined' && (type as any).name === 'BigInt') return 'integer';
  if (type === Boolean) return 'boolean';
  if (type === Date) return 'datetime';

  // Fallback – safe default
  return 'text';
}

function getSqliteType(entityType: string): string {
  const upper = entityType.toUpperCase();
  if (upper === 'UUID' || upper.includes('UUID')) return 'VARCHAR(36)';
  if (upper.includes('TEXT') || upper.includes('VARCHAR') || upper.includes('CHAR')) return 'TEXT';
  if (upper.includes('INTEGER') || upper.includes('INT')) return 'INTEGER';
  if (upper.includes('REAL') || upper.includes('FLOAT') || upper.includes('DOUBLE')) return 'REAL';
  if (upper.includes('BLOB')) return 'BLOB';
  if (upper.includes('DATE') || upper.includes('TIME')) return 'TEXT';
  if (upper.includes('BOOLEAN') || upper.includes('BOOL')) return 'INTEGER';
  return 'TEXT'; // Default to TEXT for unknown types
}

async function dropTempTablesRaw(sqlitePath: string): Promise<void> {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(sqlitePath, sqlite3.OPEN_READWRITE, async (openErr: any) => {
      if (openErr) {
        console.warn(`  ⚠️  Could not open database for temp table cleanup: ${openErr.message}`);
        resolve(); // Don't fail, just continue
        return;
      }

      try {
        // Promisify database methods
        const dbAll = promisify(db.all.bind(db));
        const dbRun = promisify(db.run.bind(db));

        // Get ALL tables
        const allRows: any[] = await dbAll("SELECT name FROM sqlite_master WHERE type = 'table'");
        
        // Debug: log all table names
        const allTableNames = allRows.map((row) => row.name);
        console.log(`  ℹ️  All tables in database: ${allTableNames.join(', ')}`);
        
        // Filter for tables starting with 'temporary_' (case-insensitive)
        const tempTables = allTableNames.filter((name) => name.toLowerCase().startsWith('temporary_'));

        // Also try to drop known problematic temp table names even if not found in query
        // (TypeORM might encounter them during metadata loading)
        const knownTempTables = ['temporary_policies', 'policies_tmp', 'policies_temp'];
        for (const knownName of knownTempTables) {
          if (!tempTables.includes(knownName) && !allTableNames.includes(knownName)) {
            // Try to drop it anyway - it might exist but not be visible in sqlite_master
            tempTables.push(knownName);
          }
        }

        if (tempTables.length === 0) {
          console.log('  ✅ No temporary tables found');
          db.close();
          resolve();
          return;
        }

        console.log(`  ⚠️  Found ${tempTables.length} temporary table(s) to clean up: ${tempTables.join(', ')}`);

        // Disable foreign key checks
        try {
          await dbRun('PRAGMA foreign_keys = OFF');
        } catch (err: any) {
          console.warn(`  ⚠️  Could not disable foreign keys: ${err.message}`);
        }

        // Drop each temporary table
        for (const tempName of tempTables) {
          try {
            console.log(`  🔧 Drop temporary table: ${tempName}`);
            await dbRun(`DROP TABLE IF EXISTS "${tempName}"`);
            console.log(`     ✅ Dropped`);
          } catch (err: any) {
            // Log warning but don't throw - this must not fail the whole script
            console.warn(`     ⚠️  Drop failed for ${tempName}: ${err.message}`);
          }
        }

        // Re-enable foreign keys
        try {
          await dbRun('PRAGMA foreign_keys = ON');
        } catch (err: any) {
          // Ignore errors when re-enabling
        }

        // Close database connection and wait a bit to ensure changes are flushed
        return new Promise<void>((closeResolve) => {
          db.close((closeErr: any) => {
            if (closeErr) {
              console.warn(`  ⚠️  Error closing database: ${closeErr.message}`);
            }
            // Small delay to ensure SQLite file is fully written
            setTimeout(() => {
              resolve();
              closeResolve();
            }, 100);
          });
        });
      } catch (err: any) {
        console.warn(`  ⚠️  Error during temp table cleanup: ${err.message}`);
        db.close();
        resolve(); // Don't fail, just continue
      }
    });
  });
}

async function repairSqlite() {
  console.log('=== PHASE 1: SQLite Repair Script ===\n');

  const dbConfig = dbConfigFactory();

  // Get SQLite path before initializing DataSource
  let sqlitePath: string;
  if (dbConfig.type === 'sqlite') {
    sqlitePath = (dbConfig as any).database;
  } else {
    console.log('⚠️  This script is designed for SQLite only.');
    console.log(`   Current DB type: ${dbConfig.type}`);
    return;
  }

  console.log(`SQLite file: ${sqlitePath}\n`);

  // Step 1: Drop temporary tables BEFORE TypeORM initializes (to avoid constraint errors)
  console.log('📋 Step 1: Detecting temporary tables...');
  await dropTempTablesRaw(sqlitePath);

  // Disable synchronize to prevent TypeORM from creating tables during initialization
  const repairConfig = { ...dbConfig, synchronize: false } as DataSourceOptions;

  // Now initialize TypeORM DataSource (temp tables should be gone, synchronize disabled)
  const dataSource = new DataSource(repairConfig);

  try {
    // Try to initialize - if it fails due to temp table, drop again and retry
    try {
      await dataSource.initialize();
      console.log('✅ Database connected\n');
    } catch (initError: any) {
      // If initialization fails due to temporary_policies, try dropping again
      if (initError.message?.includes('temporary_policies') || initError.message?.includes('temporary_')) {
        console.log('  ⚠️  TypeORM encountered temporary table, attempting cleanup again...');
        await dropTempTablesRaw(sqlitePath);
        // Small delay to ensure drops are flushed
        await new Promise((resolve) => setTimeout(resolve, 200));
        // Retry initialization
        await dataSource.initialize();
        console.log('✅ Database connected\n');
      } else {
        throw initError;
      }
    }

    const actions: RepairAction[] = [];
    const tables = await getAllTables(dataSource);
    const entityMetadatas = dataSource.entityMetadatas;

    // Step 2: Detect missing columns and add them
    console.log('\n📋 Step 2: Detecting missing columns...');
    for (const metadata of entityMetadatas) {
      const tableName = metadata.tableName;
      const dbColumns = await getTableInfo(dataSource, tableName);
      const dbColumnMap = new Map(dbColumns.map((c) => [c.name.toLowerCase(), c]));

      for (const col of metadata.columns) {
        const dbColName = (col.databaseName || col.propertyName).toLowerCase();
        const dbCol = dbColumnMap.get(dbColName);

        if (!dbCol) {
          // Column is missing - add it
          const normalizedType = normalizeColumnType(col.type);
          const sqliteType = getSqliteType(normalizedType);
          const nullable = col.isNullable ? '' : ' NOT NULL';
          const defaultValue = col.default !== undefined ? ` DEFAULT ${col.default}` : '';
          
          // For NOT NULL columns without defaults, allow NULL initially (we'll populate later)
          const allowNull = col.isNullable || col.default !== undefined ? '' : '';
          
          actions.push({
            type: 'add_column',
            table: tableName,
            description: `Add missing column: ${col.databaseName} (${sqliteType})`,
            sql: `ALTER TABLE ${tableName} ADD COLUMN ${col.databaseName} ${sqliteType}${allowNull}${defaultValue}`,
          });
        }
      }
    }

    console.log(`  Found ${actions.filter((a) => a.type === 'add_column').length} missing column(s)`);

    // Step 3: Fix NOT NULL violations by populating defaults
    console.log('\n📋 Step 3: Detecting NOT NULL violations...');
    for (const metadata of entityMetadatas) {
      const tableName = metadata.tableName;
      const dbColumns = await getTableInfo(dataSource, tableName);
      const dbColumnMap = new Map(dbColumns.map((c) => [c.name.toLowerCase(), c]));

      for (const col of metadata.columns) {
        const dbColName = (col.databaseName || col.propertyName).toLowerCase();
        const dbCol = dbColumnMap.get(dbColName);

        if (dbCol && !col.isNullable && !col.isPrimary) {
          // Check if there are NULL values
          const queryRunner = dataSource.createQueryRunner();
          try {
            const nullCount = await queryRunner.query(
              `SELECT COUNT(*) as count FROM ${tableName} WHERE ${dbCol.name} IS NULL`,
            );
            const count = nullCount[0]?.count || 0;

            if (count > 0) {
              // Need to populate defaults
              let defaultValue: string;
              const normalizedType = normalizeColumnType(col.type);
              
              if (col.databaseName.toLowerCase() === 'tenant_id') {
                defaultValue = `'${getDefaultTenantId()}'`;
              } else if (normalizedType === 'uuid' || normalizedType.includes('uuid')) {
                // Generate UUID for existing NULL values
                defaultValue = `(lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))))`;
              } else if (normalizedType.includes('text') || normalizedType.includes('varchar')) {
                defaultValue = `''`;
              } else if (normalizedType.includes('int') || normalizedType.includes('integer')) {
                defaultValue = '0';
              } else if (normalizedType.includes('date') || normalizedType.includes('time') || normalizedType.includes('datetime')) {
                defaultValue = `datetime('now')`;
              } else {
                defaultValue = `''`;
              }

              actions.push({
                type: 'populate_default',
                table: tableName,
                description: `Populate NULL values in ${col.databaseName} (${count} rows)`,
                sql: `UPDATE ${tableName} SET ${dbCol.name} = ${defaultValue} WHERE ${dbCol.name} IS NULL`,
              });
            }
          } finally {
            await queryRunner.release();
          }
        }
      }
    }

    console.log(`  Found ${actions.filter((a) => a.type === 'populate_default').length} NOT NULL violation(s)`);

    // Step 4: Ensure tenant_id exists and is populated
    console.log('\n📋 Step 4: Checking tenant_id columns...');
    for (const metadata of entityMetadatas) {
      const tableName = metadata.tableName;
      const dbColumns = await getTableInfo(dataSource, tableName);
      const hasTenantId = dbColumns.some((c) => c.name.toLowerCase() === 'tenant_id');
      
      // Check if entity expects tenant_id
      const entityHasTenantId = metadata.columns.some(
        (c) => (c.databaseName || c.propertyName).toLowerCase() === 'tenant_id',
      );

      if (entityHasTenantId && !hasTenantId) {
        // Add tenant_id column
        actions.push({
          type: 'fix_tenant_id',
          table: tableName,
          description: `Add tenant_id column to ${tableName}`,
          sql: `ALTER TABLE ${tableName} ADD COLUMN tenant_id VARCHAR(36)`,
        });
      }

      if (hasTenantId) {
        // Check for NULL tenant_id values
        const queryRunner = dataSource.createQueryRunner();
        try {
          const nullCount = await queryRunner.query(
            `SELECT COUNT(*) as count FROM ${tableName} WHERE tenant_id IS NULL`,
          );
          const count = nullCount[0]?.count || 0;

          if (count > 0) {
            actions.push({
              type: 'fix_tenant_id',
              table: tableName,
              description: `Populate tenant_id in ${tableName} (${count} rows)`,
              sql: `UPDATE ${tableName} SET tenant_id = '${getDefaultTenantId()}' WHERE tenant_id IS NULL`,
            });
          }
        } finally {
          await queryRunner.release();
        }
      }
    }

    console.log(`  Found ${actions.filter((a) => a.type === 'fix_tenant_id').length} tenant_id issue(s)`);

    // Step 5: Fix name/title mismatches (policies table)
    console.log('\n📋 Step 5: Checking name/title column mismatches...');
    const policiesTable = 'policies';
    if (tables.includes(policiesTable)) {
      const dbColumns = await getTableInfo(dataSource, policiesTable);
      const hasName = dbColumns.some((c) => c.name.toLowerCase() === 'name');
      const hasTitle = dbColumns.some((c) => c.name.toLowerCase() === 'title');

      // PolicyEntity expects 'title', not 'name'
      if (hasName && !hasTitle) {
        // Add title column and populate from name
        actions.push({
          type: 'fix_name_title',
          table: policiesTable,
          description: `Add title column and populate from name`,
          sql: `ALTER TABLE ${policiesTable} ADD COLUMN title TEXT`,
        });
        
        actions.push({
          type: 'fix_name_title',
          table: policiesTable,
          description: `Populate title from name`,
          sql: `UPDATE ${policiesTable} SET title = name WHERE title IS NULL`,
        });
      }
    }

    console.log(`  Found ${actions.filter((a) => a.type === 'fix_name_title').length} name/title mismatch(es)`);

    // Execute all actions
    console.log('\n📋 Executing repair actions...\n');
    
    if (actions.length === 0) {
      console.log('✅ No repairs needed. Schema is already in sync.\n');
    } else {
      console.log(`Found ${actions.length} repair action(s) to execute:\n`);

      for (const action of actions) {
        await executeSql(dataSource, action.sql, action.description);
      }

      console.log('\n✅ All repair actions completed successfully!\n');
    }

    // Final verification
    console.log('📋 Final verification...');
    const finalErrors: string[] = [];
    
    for (const metadata of entityMetadatas) {
      const tableName = metadata.tableName;
      const dbColumns = await getTableInfo(dataSource, tableName);
      const dbColumnMap = new Map(dbColumns.map((c) => [c.name.toLowerCase(), c]));

      for (const col of metadata.columns) {
        const dbColName = (col.databaseName || col.propertyName).toLowerCase();
        const dbCol = dbColumnMap.get(dbColName);

        if (!dbCol && !col.isNullable && !col.isPrimary) {
          finalErrors.push(`[${tableName}] Missing required column: ${col.databaseName}`);
        }
      }
    }

    if (finalErrors.length > 0) {
      console.log('\n⚠️  Warnings after repair:');
      finalErrors.forEach((err) => console.log(`  - ${err}`));
    } else {
      console.log('  ✅ All required columns are present');
    }

    console.log('\n✅ SQLite repair completed successfully!');
    console.log('   You can now restart the backend.\n');

  } catch (error: any) {
    console.error('\n❌ Repair failed:', error?.message || error);
    if (error?.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

repairSqlite().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

