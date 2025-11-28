#!/usr/bin/env ts-node
/**
 * DB Schema Check Script
 * 
 * Compares TypeORM entity definitions with actual SQLite schema.
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/check-db-schema.ts
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { dbConfigFactory } from '../src/config/database.config';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number; // 0 = nullable, 1 = not null
  dflt_value: string | null;
  pk: number; // 0 = not primary key, 1 = primary key
}

interface TableSchema {
  name: string;
  columns: ColumnInfo[];
}

async function getTableInfo(
  dataSource: DataSource,
  tableName: string,
): Promise<ColumnInfo[]> {
  const queryRunner = dataSource.createQueryRunner();
  try {
    const result = await queryRunner.query(`PRAGMA table_info(${tableName})`);
    return result as ColumnInfo[];
  } finally {
    await queryRunner.release();
  }
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

function normalizeSqliteType(type: string): string {
  // SQLite type normalization
  const upper = type.toUpperCase();
  if (upper.includes('VARCHAR') || upper.includes('TEXT')) return 'TEXT';
  if (upper.includes('INTEGER') || upper.includes('INT')) return 'INTEGER';
  if (upper.includes('REAL') || upper.includes('FLOAT') || upper.includes('DOUBLE')) return 'REAL';
  if (upper.includes('BLOB')) return 'BLOB';
  if (upper.includes('NUMERIC')) return 'NUMERIC';
  return type;
}

async function main() {
  console.log('=== DB Schema Check Script ===\n');

  const dbConfig = dbConfigFactory();
  const dataSource = new DataSource(dbConfig as DataSourceOptions);

  try {
    await dataSource.initialize();
    console.log('✅ Database connected\n');

    // Check if SQLite
    if (dataSource.options.type !== 'sqlite') {
      console.log('⚠️  This script is designed for SQLite. Current DB type:', dataSource.options.type);
      console.log('   Skipping schema check.\n');
      await dataSource.destroy();
      return;
    }

    const tables = await getAllTables(dataSource);
    console.log(`Found ${tables.length} tables in database:\n`);

    // Get TypeORM metadata
    const entityMetadatas = dataSource.entityMetadatas;
    console.log(`Found ${entityMetadatas.length} entities in TypeORM:\n`);

    // Critical tables to check
    const criticalTables = ['policies', 'requirements', 'bia_process', 'bcp_plan', 'bcp_exercise', 'audit_logs'];

    const issues: Array<{
      table: string;
      entity: string;
      issue: string;
      severity: 'error' | 'warning' | 'info';
    }> = [];

    for (const metadata of entityMetadatas) {
      const tableName = metadata.tableName;
      const entityName = metadata.name;

      if (!tables.includes(tableName)) {
        issues.push({
          table: tableName,
          entity: entityName,
          issue: `Table '${tableName}' does not exist in database`,
          severity: 'error',
        });
        continue;
      }

      const dbColumns = await getTableInfo(dataSource, tableName);
      const entityColumns = metadata.columns;

      // Check for missing columns in DB
      for (const col of entityColumns) {
        const dbCol = dbColumns.find((c) => c.name === col.databaseName || c.name === col.propertyName);
        if (!dbCol) {
          issues.push({
            table: tableName,
            entity: entityName,
            issue: `Column '${col.databaseName || col.propertyName}' missing in database`,
            severity: 'error',
          });
        } else {
          // Check NOT NULL constraints
          const isNotNullInDB = dbCol.notnull === 1;
          const isNotNullInEntity = !col.isNullable;
          
          if (isNotNullInDB && !isNotNullInEntity && !col.isPrimary) {
            issues.push({
              table: tableName,
              entity: entityName,
              issue: `Column '${col.databaseName}' is NOT NULL in DB but nullable in entity`,
              severity: 'warning',
            });
          }

          // Check UUID types (should be varchar(36) in SQLite)
          if (col.type === 'uuid' && !dbCol.type.toLowerCase().includes('varchar') && !dbCol.type.toLowerCase().includes('text')) {
            issues.push({
              table: tableName,
              entity: entityName,
              issue: `Column '${col.databaseName}' is UUID in entity but DB type is '${dbCol.type}' (expected varchar/text)`,
              severity: 'warning',
            });
          }
        }
      }

      // Check for extra columns in DB (not critical, just info)
      for (const dbCol of dbColumns) {
        const entityCol = entityColumns.find(
          (c) => c.databaseName === dbCol.name || c.propertyName === dbCol.name,
        );
        if (!entityCol) {
          issues.push({
            table: tableName,
            entity: entityName,
            issue: `Extra column '${dbCol.name}' in database (not in entity)`,
            severity: 'info',
          });
        }
      }
    }

    // Report
    console.log('=== Schema Check Results ===\n');

    if (issues.length === 0) {
      console.log('✅ No issues found!\n');
    } else {
      const errors = issues.filter((i) => i.severity === 'error');
      const warnings = issues.filter((i) => i.severity === 'warning');
      const infos = issues.filter((i) => i.severity === 'info');

      if (errors.length > 0) {
        console.log(`❌ ERRORS (${errors.length}):\n`);
        errors.forEach((issue) => {
          console.log(`  [${issue.table}] ${issue.issue}`);
        });
        console.log('');
      }

      if (warnings.length > 0) {
        console.log(`⚠️  WARNINGS (${warnings.length}):\n`);
        warnings.forEach((issue) => {
          console.log(`  [${issue.table}] ${issue.issue}`);
        });
        console.log('');
      }

      if (infos.length > 0) {
        console.log(`ℹ️  INFO (${infos.length}):\n`);
        infos.forEach((issue) => {
          console.log(`  [${issue.table}] ${issue.issue}`);
        });
        console.log('');
      }
    }

    // Summary table for critical tables
    console.log('=== Critical Tables Summary ===\n');
    console.log('Entity Name | Table Name | Critical Issues');
    console.log('─'.repeat(60));

    for (const tableName of criticalTables) {
      const metadata = entityMetadatas.find((m) => m.tableName === tableName);
      const tableIssues = issues.filter((i) => i.table === tableName && i.severity === 'error');
      const hasIssues = tableIssues.length > 0;

      if (metadata) {
        console.log(
          `${metadata.name.padEnd(20)} | ${tableName.padEnd(15)} | ${hasIssues ? '❌ YES' : '✅ NO'}`,
        );
      } else if (tables.includes(tableName)) {
        console.log(
          `${'N/A'.padEnd(20)} | ${tableName.padEnd(15)} | ⚠️  Entity not found`,
        );
      }
    }

    console.log('');

    if (issues.filter((i) => i.severity === 'error').length > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

