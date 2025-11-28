#!/usr/bin/env ts-node
/**
 * Fix Policy Table Schema
 * Migrates policies table from legacy schema to new schema
 * 
 * Strategy:
 * 1. Check if table exists
 * 2. Check if legacy columns exist (name, description, owner, etc.)
 * 3. If legacy columns exist:
 *    a. Create temporary table with new schema
 *    b. Copy data from old table (code, title, status, etc.)
 *    c. Drop old table
 *    d. Rename temporary table to policies
 * 4. If no legacy columns, do nothing (idempotent)
 * 
 * WARNING: This will DELETE all existing policy data if legacy columns are detected!
 * Only use in development environment.
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import { PolicyEntity } from '../src/entities/app/policy.entity';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

function determineDataSourceOptions(): DataSourceOptions {
  const dbDriver = (process.env.DB_DRIVER || '').toLowerCase();
  const databaseUrl = process.env.DATABASE_URL;
  const preferPostgres = dbDriver === 'postgres' || !!databaseUrl;

  if (preferPostgres) {
    console.error('❌ This script is designed for SQLite only.');
    process.exit(1);
  }

  const sqliteRelative = process.env.SQLITE_FILE || process.env.DB_NAME || 'data/grc.sqlite';
  const sqlitePath = path.isAbsolute(sqliteRelative)
    ? sqliteRelative
    : path.join(process.cwd(), sqliteRelative);

  return {
    type: 'sqlite',
    database: sqlitePath,
    logging: true,
    entities: [PolicyEntity],
    synchronize: false, // We'll manually migrate
  };
}

async function fixSchema() {
  const options = determineDataSourceOptions();
  const dataSource = new DataSource(options);

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');
    console.log(`SQLite file: ${(options as any).database}`);

    const queryRunner = dataSource.createQueryRunner();

    // Check if table exists
    const tableExists = await queryRunner.query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='policies'`
    );

    if (tableExists.length === 0) {
      console.log('⚠️  policies table does not exist. It will be created by TypeORM synchronize.');
      await queryRunner.release();
      return;
    }

    // Check if table has legacy columns
    const tableInfo = await queryRunner.query(`PRAGMA table_info(policies)`);
    const columnNames = tableInfo.map((col: any) => col.name.toLowerCase());
    
    const legacyColumns = [
      'name', 'description', 'owner', 'version', 
      'effectivedate', 'reviewdate', 'tags', 
      'createdat', 'updatedat', 'deletedat'
    ];
    
    const hasLegacyColumns = legacyColumns.some(legacyCol => 
      columnNames.includes(legacyCol)
    );

    if (!hasLegacyColumns) {
      console.log('✅ policies table already has correct schema (no legacy columns).');
      console.log('   No migration needed.');
      await queryRunner.release();
      return;
    }

    console.log('\n⚠️  WARNING: Legacy columns detected!');
    console.log('   This migration will:');
    console.log('   1. Create a temporary table with the correct schema');
    console.log('   2. Copy compatible data from old table');
    console.log('   3. Drop the old table');
    console.log('   4. Rename temporary table to policies');
    console.log('\n   ⚠️  This will DELETE all existing policy data!');
    console.log('   Only compatible columns (code, title, status, etc.) will be preserved.\n');

    // Start transaction
    await queryRunner.startTransaction();

    try {
      // Step 1: Create temporary table with correct schema
      console.log('📋 Step 1: Creating temporary table with correct schema...');
      // Check if temporary table already exists (idempotency)
      const tmpTableExists = await queryRunner.query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='policies_tmp'`
      );
      if (tmpTableExists.length > 0) {
        console.log('   ℹ️  Temporary table policies_tmp already exists, dropping it first...');
        await queryRunner.query(`DROP TABLE IF EXISTS policies_tmp`);
      }
      
      await queryRunner.query(`
        CREATE TABLE policies_tmp (
          id VARCHAR(36) PRIMARY KEY NOT NULL,
          tenant_id VARCHAR(36) NOT NULL,
          code TEXT NOT NULL,
          title TEXT NOT NULL,
          status TEXT NOT NULL,
          owner_first_name TEXT,
          owner_last_name TEXT,
          effective_date DATE,
          review_date DATE,
          content TEXT,
          created_by VARCHAR(36),
          updated_by VARCHAR(36),
          created_at DATETIME NOT NULL,
          updated_at DATETIME NOT NULL
        )
      `);
      console.log('   ✅ Temporary table created');

      // Step 2: Copy compatible data
      console.log('📋 Step 2: Copying compatible data from old table...');
      
      // Check which columns exist in old table using PRAGMA
      const hasTitle = columnNames.includes('title');
      const hasName = columnNames.includes('name');
      const hasCode = columnNames.includes('code');
      const hasStatus = columnNames.includes('status');
      const hasTenantId = columnNames.includes('tenant_id');
      const hasOwnerFirstName = columnNames.includes('owner_first_name');
      const hasOwnerLastName = columnNames.includes('owner_last_name');
      const hasEffectiveDate = columnNames.includes('effective_date') || columnNames.includes('effectivedate');
      const hasReviewDate = columnNames.includes('review_date') || columnNames.includes('reviewdate');
      const hasContent = columnNames.includes('content');
      const hasCreatedBy = columnNames.includes('created_by');
      const hasUpdatedBy = columnNames.includes('updated_by');
      const hasCreatedAt = columnNames.includes('created_at') || columnNames.includes('createdat');
      const hasUpdatedAt = columnNames.includes('updated_at') || columnNames.includes('updatedat');

      // Log tenant_id detection
      if (hasTenantId) {
        console.log('   ℹ️  Found tenant_id column in existing policies table');
      } else {
        console.log('   ℹ️  tenant_id column NOT found in existing policies table');
        console.log('   ℹ️  Will use default tenant ID for all migrated rows');
      }

      // Build SELECT and INSERT statements
      // IMPORTANT: Column order must match temporary table schema:
      // id, tenant_id, code, title, status, owner_first_name, owner_last_name, 
      // effective_date, review_date, content, created_by, updated_by, created_at, updated_at
      let selectColumns = [];
      let insertColumns = [];
      
      // ID: generate new UUIDs for migrated records (must be first)
      selectColumns.push("lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) AS id");
      insertColumns.push('id');
      
      // tenant_id: REQUIRED NOT NULL - handle both scenarios
      if (hasTenantId) {
        // Scenario A: Existing table has tenant_id - include it in SELECT
        selectColumns.push('tenant_id');
        insertColumns.push('tenant_id');
        console.log('   ✅ Including tenant_id from existing table');
      } else {
        // Scenario B: Existing table does NOT have tenant_id - use default
        const defaultTenant = process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
        selectColumns.push(`'${defaultTenant}' AS tenant_id`);
        insertColumns.push('tenant_id');
        console.log(`   ✅ Using default tenant ID: ${defaultTenant}`);
      }
      
      // code: REQUIRED
      if (hasCode) {
        selectColumns.push('code');
        insertColumns.push('code');
      } else {
        // Generate code from title/name if code doesn't exist
        if (hasTitle) {
          selectColumns.push("lower(replace(title, ' ', '-')) AS code");
        } else if (hasName) {
          selectColumns.push("lower(replace(name, ' ', '-')) AS code");
        } else {
          selectColumns.push("'POL-' || lower(hex(randomblob(4))) AS code");
        }
        insertColumns.push('code');
      }
      
      // title: REQUIRED
      if (hasTitle) {
        selectColumns.push('title');
        insertColumns.push('title');
      } else if (hasName) {
        // Use name as title if title doesn't exist
        selectColumns.push('name AS title');
        insertColumns.push('title');
      } else {
        // Fallback: use code as title
        selectColumns.push('code AS title');
        insertColumns.push('title');
      }
      
      // status: REQUIRED
      if (hasStatus) {
        selectColumns.push('status');
        insertColumns.push('status');
      } else {
        selectColumns.push("'draft' AS status");
        insertColumns.push('status');
      }
      
      // Optional columns
      if (hasOwnerFirstName) {
        selectColumns.push('owner_first_name');
        insertColumns.push('owner_first_name');
      }
      if (hasOwnerLastName) {
        selectColumns.push('owner_last_name');
        insertColumns.push('owner_last_name');
      }
      if (hasEffectiveDate) {
        const effectiveDateCol = columnNames.includes('effective_date') ? 'effective_date' : 'effectiveDate';
        selectColumns.push(`${effectiveDateCol} AS effective_date`);
        insertColumns.push('effective_date');
      }
      if (hasReviewDate) {
        const reviewDateCol = columnNames.includes('review_date') ? 'review_date' : 'reviewDate';
        selectColumns.push(`${reviewDateCol} AS review_date`);
        insertColumns.push('review_date');
      }
      if (hasContent) {
        selectColumns.push('content');
        insertColumns.push('content');
      }
      if (hasCreatedBy) {
        selectColumns.push('created_by');
        insertColumns.push('created_by');
      }
      if (hasUpdatedBy) {
        selectColumns.push('updated_by');
        insertColumns.push('updated_by');
      }
      if (hasCreatedAt) {
        const createdAtCol = columnNames.includes('created_at') ? 'created_at' : 'createdAt';
        selectColumns.push(`${createdAtCol} AS created_at`);
        insertColumns.push('created_at');
      } else {
        // Use current timestamp in ISO format (DB-agnostic)
        const now = new Date().toISOString();
        selectColumns.push(`'${now}' AS created_at`);
        insertColumns.push('created_at');
      }
      if (hasUpdatedAt) {
        const updatedAtCol = columnNames.includes('updated_at') ? 'updated_at' : 'updatedAt';
        selectColumns.push(`${updatedAtCol} AS updated_at`);
        insertColumns.push('updated_at');
      } else {
        // Use current timestamp in ISO format (DB-agnostic)
        const now = new Date().toISOString();
        selectColumns.push(`'${now}' AS updated_at`);
        insertColumns.push('updated_at');
      }

      // CRITICAL VALIDATION: Ensure tenant_id is included (required for NOT NULL constraint)
      if (!insertColumns.includes('tenant_id')) {
        throw new Error('CRITICAL: tenant_id must be included in INSERT columns but was missing! This will cause NOT NULL constraint failure.');
      }
      const tenantIdInSelect = selectColumns.some(col => 
        col.includes('tenant_id') || col.includes("'217492b2-f814-4ba0-ae50-4e4f8ecf6216'")
      );
      if (!tenantIdInSelect) {
        throw new Error('CRITICAL: tenant_id must be included in SELECT columns but was missing! This will cause NOT NULL constraint failure.');
      }

      // Build final INSERT statement
      // Ensure column order matches temporary table schema exactly
      const selectQuery = `SELECT ${selectColumns.join(', ')} FROM policies`;
      const insertQuery = `INSERT INTO policies_tmp (${insertColumns.join(', ')}) ${selectQuery}`;
      
      // Log the query for debugging
      console.log(`   ℹ️  Executing INSERT with ${insertColumns.length} columns`);
      console.log(`   ℹ️  Column order: ${insertColumns.slice(0, 5).join(', ')}...`);
      console.log(`   ℹ️  tenant_id handling: ${hasTenantId ? 'from existing column' : 'using default value'}`);
      
      await queryRunner.query(insertQuery);
      const rowCount = await queryRunner.query(`SELECT COUNT(*) as count FROM policies_tmp`);
      console.log(`   ✅ Copied ${rowCount[0]?.count || 0} rows`);

      // Step 3: Drop old table
      console.log('📋 Step 3: Dropping old table...');
      await queryRunner.dropTable('policies', true, true, true);
      console.log('   ✅ Old table dropped');

      // Step 4: Rename temporary table
      console.log('📋 Step 4: Renaming temporary table to policies...');
      await queryRunner.query(`ALTER TABLE policies_tmp RENAME TO policies`);
      console.log('   ✅ Table renamed');

      // Create index
      console.log('📋 Step 5: Creating index...');
      await queryRunner.query(`CREATE INDEX idx_policies_tenant ON policies(tenant_id)`);
      console.log('   ✅ Index created');

      // Commit transaction
      await queryRunner.commitTransaction();
      console.log('\n✅ Schema migration completed successfully!');
      console.log('   The policies table now matches PolicyEntity schema.');
      console.log('   Please restart the backend to ensure TypeORM recognizes the new schema.');

    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

  } catch (error: any) {
    console.error('❌ Schema fix failed:', error?.message || error);
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

fixSchema();
