#!/usr/bin/env ts-node
/**
 * PHASE 0: DB Foundation - System & Schema Diagnosis
 * 
 * Performs read-only analysis of:
 * - All TypeORM entities
 * - SQLite table schemas
 * - Column-by-column comparison
 * - Detects mismatches (missing columns, NOT NULL issues, etc.)
 * 
 * Output: PHASE0-DB-SNAPSHOT.md
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/phase0-db-snapshot.ts
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

interface EntityColumn {
  propertyName: string;
  databaseName: string;
  type: string;
  isNullable: boolean;
  isPrimary: boolean;
  default?: any;
  length?: number;
}

interface TableAnalysis {
  tableName: string;
  entityName: string;
  exists: boolean;
  dbColumns: ColumnInfo[];
  entityColumns: EntityColumn[];
  issues: Array<{
    type: 'missing_column' | 'missing_entity' | 'not_null_mismatch' | 'type_mismatch' | 'extra_column' | 'tenant_id_issue';
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
}

async function getTableInfo(
  dataSource: DataSource,
  tableName: string,
): Promise<ColumnInfo[]> {
  const queryRunner = dataSource.createQueryRunner();
  try {
    const result = await queryRunner.query(`PRAGMA table_info(${tableName})`);
    return result as ColumnInfo[];
  } catch (error: any) {
    // Table doesn't exist
    return [];
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
  const upper = type.toUpperCase();
  if (upper.includes('VARCHAR') || upper.includes('TEXT') || upper.includes('CHAR')) return 'TEXT';
  if (upper.includes('INTEGER') || upper.includes('INT')) return 'INTEGER';
  if (upper.includes('REAL') || upper.includes('FLOAT') || upper.includes('DOUBLE')) return 'REAL';
  if (upper.includes('BLOB')) return 'BLOB';
  if (upper.includes('NUMERIC') || upper.includes('DECIMAL')) return 'NUMERIC';
  if (upper.includes('DATE') || upper.includes('TIME')) return 'TEXT'; // SQLite stores dates as TEXT
  return type;
}

function analyzeTable(
  tableName: string,
  entityMetadata: any,
  dbColumns: ColumnInfo[],
): TableAnalysis {
  const entityName = entityMetadata.name;
  const entityColumns: EntityColumn[] = entityMetadata.columns.map((col: any) => ({
    propertyName: col.propertyName,
    databaseName: col.databaseName || col.propertyName,
    type: col.type || 'unknown',
    isNullable: col.isNullable || false,
    isPrimary: col.isPrimary || false,
    default: col.default,
    length: col.length,
  }));

  const issues: TableAnalysis['issues'] = [];
  const dbColumnMap = new Map(dbColumns.map((c) => [c.name.toLowerCase(), c]));

  // Check for missing columns in DB
  for (const entityCol of entityColumns) {
    const dbCol = dbColumnMap.get(entityCol.databaseName.toLowerCase());
    
    if (!dbCol) {
      issues.push({
        type: 'missing_column',
        message: `Column '${entityCol.databaseName}' (${entityCol.type}) is missing in database`,
        severity: entityCol.isNullable ? 'warning' : 'error',
      });
    } else {
      // Check NOT NULL constraints
      const isNotNullInDB = dbCol.notnull === 1;
      const isNotNullInEntity = !entityCol.isNullable;
      
      if (isNotNullInDB && !isNotNullInEntity && !entityCol.isPrimary) {
        issues.push({
          type: 'not_null_mismatch',
          message: `Column '${entityCol.databaseName}' is NOT NULL in DB but nullable in entity`,
          severity: 'warning',
        });
      }
      
      if (!isNotNullInDB && isNotNullInEntity && !entityCol.isPrimary) {
        issues.push({
          type: 'not_null_mismatch',
          message: `Column '${entityCol.databaseName}' is nullable in DB but NOT NULL in entity (missing NOT NULL constraint)`,
          severity: 'error',
        });
      }

      // Check for tenant_id issues
      if (entityCol.databaseName.toLowerCase() === 'tenant_id') {
        if (!isNotNullInDB && isNotNullInEntity) {
          issues.push({
            type: 'tenant_id_issue',
            message: `tenant_id is NOT NULL in entity but nullable in DB - this will cause boot errors`,
            severity: 'error',
          });
        }
      }
    }
  }

  // Check for extra columns in DB (not in entity)
  for (const dbCol of dbColumns) {
    const entityCol = entityColumns.find(
      (c) => c.databaseName.toLowerCase() === dbCol.name.toLowerCase(),
    );
    if (!entityCol) {
      issues.push({
        type: 'extra_column',
        message: `Column '${dbCol.name}' exists in DB but not in entity`,
        severity: 'info',
      });
    }
  }

  return {
    tableName,
    entityName,
    exists: dbColumns.length > 0,
    dbColumns,
    entityColumns,
    issues,
  };
}

async function generateReport(analyses: TableAnalysis[], outputPath: string) {
  const timestamp = new Date().toISOString();
  const errors = analyses.flatMap((a) => a.issues.filter((i) => i.severity === 'error'));
  const warnings = analyses.flatMap((a) => a.issues.filter((i) => i.severity === 'warning'));
  const infos = analyses.flatMap((a) => a.issues.filter((i) => i.severity === 'info'));

  const report = `# PHASE 0: DB Foundation - System & Schema Diagnosis

**Generated:** ${timestamp}

## Executive Summary

- **Total Entities Analyzed:** ${analyses.length}
- **Tables in Database:** ${analyses.filter((a) => a.exists).length}
- **Missing Tables:** ${analyses.filter((a) => !a.exists).length}
- **Critical Errors:** ${errors.length}
- **Warnings:** ${warnings.length}
- **Info Items:** ${infos.length}

## Critical Issues Summary

${errors.length === 0 ? '✅ **No critical errors found**' : `❌ **${errors.length} critical error(s) detected**`}

${errors.length > 0 ? errors.map((e, i) => `${i + 1}. ${e.message}`).join('\n') : ''}

## Detailed Analysis

${analyses.map((analysis) => {
  const hasIssues = analysis.issues.length > 0;
  const statusIcon = !analysis.exists ? '❌' : hasIssues ? '⚠️' : '✅';
  
  return `### ${statusIcon} ${analysis.tableName} (${analysis.entityName})

**Status:** ${analysis.exists ? 'Table exists' : 'Table missing'}

**Entity Columns:**
${analysis.entityColumns.map((col) => {
  const dbCol = analysis.dbColumns.find((c) => c.name.toLowerCase() === col.databaseName.toLowerCase());
  const status = dbCol ? '✅' : '❌';
  return `- ${status} \`${col.databaseName}\` (${col.type}) - ${col.isNullable ? 'nullable' : 'NOT NULL'} ${col.isPrimary ? '[PK]' : ''}`;
}).join('\n')}

**Database Columns:**
${analysis.dbColumns.length > 0 ? analysis.dbColumns.map((col) => {
  const entityCol = analysis.entityColumns.find((c) => c.databaseName.toLowerCase() === col.name.toLowerCase());
  const status = entityCol ? '✅' : '⚠️';
  return `- ${status} \`${col.name}\` (${col.type}) - ${col.notnull === 1 ? 'NOT NULL' : 'nullable'} ${col.pk === 1 ? '[PK]' : ''}`;
}).join('\n') : '  (table does not exist)'}

**Issues:**
${analysis.issues.length === 0 ? '  ✅ No issues detected' : analysis.issues.map((issue) => {
  const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
  return `  ${icon} **[${issue.severity.toUpperCase()}]** ${issue.message}`;
}).join('\n')}
`;
}).join('\n\n')}

## Issue Breakdown by Type

### Missing Columns (${analyses.flatMap((a) => a.issues.filter((i) => i.type === 'missing_column')).length})
${analyses.flatMap((a) => a.issues.filter((i) => i.type === 'missing_column').map((i) => `- [${a.tableName}] ${i.message}`)).join('\n') || '  (none)'}

### NOT NULL Mismatches (${analyses.flatMap((a) => a.issues.filter((i) => i.type === 'not_null_mismatch')).length})
${analyses.flatMap((a) => a.issues.filter((i) => i.type === 'not_null_mismatch').map((i) => `- [${a.tableName}] ${i.message}`)).join('\n') || '  (none)'}

### Tenant ID Issues (${analyses.flatMap((a) => a.issues.filter((i) => i.type === 'tenant_id_issue')).length})
${analyses.flatMap((a) => a.issues.filter((i) => i.type === 'tenant_id_issue').map((i) => `- [${a.tableName}] ${i.message}`)).join('\n') || '  (none)'}

### Extra Columns (${analyses.flatMap((a) => a.issues.filter((i) => i.type === 'extra_column')).length})
${analyses.flatMap((a) => a.issues.filter((i) => i.type === 'extra_column').map((i) => `- [${a.tableName}] ${i.message}`)).join('\n') || '  (none)'}

## Recommendations

${errors.length > 0 ? `
### Immediate Actions Required

1. **Fix Missing NOT NULL Columns**
   - Add missing columns with ALTER TABLE ... ADD COLUMN
   - Populate existing rows with safe defaults before adding NOT NULL constraint

2. **Fix Tenant ID Issues**
   - Ensure all tables with tenant_id have it as NOT NULL
   - Populate tenant_id for existing rows if missing

3. **Address Schema Drift**
   - Use safe, idempotent SQL patches (not migrations)
   - Run repair scripts before boot
` : '✅ **No immediate actions required** - Schema appears to be in sync'}

## Next Steps

1. Review this snapshot
2. Create SQLite repair script (Phase 1)
3. Run repair script and validate boot (Phase 2)
4. Run smoke tests (Phase 3)
5. Verify system integrity (Phase 4)
6. Final certification (Phase 5)

---
*This is a read-only diagnostic report. No schema changes were made.*
`;

  fs.writeFileSync(outputPath, report, 'utf-8');
  console.log(`\n✅ Report written to: ${outputPath}`);
}

async function main() {
  console.log('=== PHASE 0: DB Foundation - System & Schema Diagnosis ===\n');

  const dbConfig = dbConfigFactory();
  const dataSource = new DataSource(dbConfig as DataSourceOptions);

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');

    if (dataSource.options.type !== 'sqlite') {
      console.log('⚠️  This script is designed for SQLite. Current DB type:', dataSource.options.type);
      console.log('   Skipping schema check.\n');
      await dataSource.destroy();
      return;
    }

    const sqlitePath = (dataSource.options as any).database;
    console.log(`SQLite file: ${sqlitePath}\n`);

    // Get all tables
    const tables = await getAllTables(dataSource);
    console.log(`Found ${tables.length} tables in database`);

    // Get all entities
    const entityMetadatas = dataSource.entityMetadatas;
    console.log(`Found ${entityMetadatas.length} entities in TypeORM\n`);

    // Analyze each entity
    const analyses: TableAnalysis[] = [];
    
    for (const metadata of entityMetadatas) {
      const tableName = metadata.tableName;
      const dbColumns = await getTableInfo(dataSource, tableName);
      const analysis = analyzeTable(tableName, metadata, dbColumns);
      analyses.push(analysis);
    }

    // Also check for tables without entities
    for (const tableName of tables) {
      const hasEntity = entityMetadatas.some((m) => m.tableName === tableName);
      if (!hasEntity) {
        const dbColumns = await getTableInfo(dataSource, tableName);
        analyses.push({
          tableName,
          entityName: 'N/A',
          exists: true,
          dbColumns,
          entityColumns: [],
          issues: [{
            type: 'missing_entity',
            message: `Table exists but no corresponding entity found`,
            severity: 'warning',
          }],
        });
      }
    }

    // Generate report
    const reportPath = path.join(process.cwd(), 'PHASE0-DB-SNAPSHOT.md');
    await generateReport(analyses, reportPath);

    // Print summary
    const errors = analyses.flatMap((a) => a.issues.filter((i) => i.severity === 'error'));
    const warnings = analyses.flatMap((a) => a.issues.filter((i) => i.severity === 'warning'));

    console.log('\n=== Summary ===');
    console.log(`Total entities: ${entityMetadatas.length}`);
    console.log(`Total tables: ${tables.length}`);
    console.log(`Critical errors: ${errors.length}`);
    console.log(`Warnings: ${warnings.length}`);

    if (errors.length > 0) {
      console.log('\n❌ Critical errors detected. See PHASE0-DB-SNAPSHOT.md for details.');
      process.exitCode = 1;
    } else {
      console.log('\n✅ No critical errors detected.');
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

