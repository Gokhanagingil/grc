#!/usr/bin/env ts-node
/**
 * Reset Policies Table Script
 * 
 * This script:
 * 1. Creates a backup of the existing policies table
 * 2. Drops the policies table and any temporary_policies tables
 * 3. Recreates the policies table with the exact schema expected by PolicyEntity
 * 
 * This is a one-time fix for SQLite schema mismatches. Data loss is acceptable
 * for dev/demo databases.
 * 
 * ⚠️  WARNING: This script is DESTRUCTIVE and DEV/DEMO ONLY.
 * It will permanently delete all policy data in SQLite.
 * 
 * Usage: npm run reset:policies
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { dbConfigFactory } from '../src/config/database.config';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

async function resetPoliciesTable() {
  console.log('=== Reset Policies Table Script ===\n');
  console.log('⚠️  WARNING: This script will DELETE all policy data in SQLite.\n');

  const dbConfig = dbConfigFactory();

  if (dbConfig.type !== 'sqlite') {
    console.log('⚠️  This script is designed for SQLite only.');
    console.log(`   Current DB type: ${dbConfig.type}`);
    return;
  }

  const sqlitePath = (dbConfig as any).database;
  console.log(`SQLite file: ${sqlitePath}\n`);

  // Disable synchronize to prevent TypeORM from creating tables during initialization
  const dataSource = new DataSource({
    ...dbConfig,
    synchronize: false,
  } as any);

  try {
    await dataSource.initialize();
    console.log('✅ Database connected\n');

    const queryRunner = dataSource.createQueryRunner();

    try {
      // Step 1: Check for temporary_policies and drop it if exists
      console.log('📋 Step 1: Checking for temporary_policies table...');
      const tempTables = await queryRunner.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'temporary_%' OR name LIKE '%_tmp' OR name LIKE '%_temp')"
      );
      
      if (tempTables.length > 0) {
        console.log(`   Found ${tempTables.length} temporary table(s):`);
        for (const table of tempTables) {
          console.log(`   - ${table.name}`);
          try {
            await queryRunner.query(`DROP TABLE IF EXISTS "${table.name}"`);
            console.log(`     ✅ Dropped ${table.name}`);
          } catch (error: any) {
            console.log(`     ⚠️  Could not drop ${table.name}: ${error.message}`);
          }
        }
      } else {
        console.log('   ✅ No temporary tables found');
      }

      // Step 2: Create backup of existing policies table
      console.log('\n📋 Step 2: Creating backup of policies table...');
      const tableExists = await queryRunner.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='policies'"
      );
      
      if (tableExists.length > 0) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const backupTableName = `policies_backup_${timestamp}`;
        
        try {
          await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "${backupTableName}" AS SELECT * FROM policies`
          );
          const rowCount = await queryRunner.query(`SELECT COUNT(*) as count FROM "${backupTableName}"`);
          console.log(`   ✅ Backup created: ${backupTableName} (${rowCount[0]?.count || 0} rows)`);
        } catch (error: any) {
          console.log(`   ⚠️  Could not create backup: ${error.message}`);
          // Continue anyway - this is dev/demo
        }
      } else {
        console.log('   ℹ️  No existing policies table to backup');
      }

      // Step 3: Drop policies table
      console.log('\n📋 Step 3: Dropping policies table...');
      try {
        await queryRunner.query('DROP TABLE IF EXISTS "policies"');
        console.log('   ✅ Dropped policies table');
      } catch (error: any) {
        console.log(`   ⚠️  Could not drop policies table: ${error.message}`);
        throw error;
      }

      // Step 4: Recreate policies table with correct schema (matching PolicyEntity)
      console.log('\n📋 Step 4: Creating policies table with correct schema...');
      await queryRunner.query(`
        CREATE TABLE "policies" (
          "id" varchar PRIMARY KEY NOT NULL,
          "tenant_id" varchar NOT NULL,
          "code" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "status" TEXT NOT NULL,
          "owner_first_name" TEXT,
          "owner_last_name" TEXT,
          "effective_date" date,
          "review_date" date,
          "content" TEXT,
          "created_by" varchar,
          "updated_by" varchar,
          "created_at" datetime NOT NULL DEFAULT (datetime('now')),
          "updated_at" datetime NOT NULL DEFAULT (datetime('now'))
        )
      `);
      
      // Create index on tenant_id
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "idx_policies_tenant" ON "policies" ("tenant_id")
      `);
      
      console.log('   ✅ Policies table created with correct schema');
      console.log('   ✅ Index created on tenant_id');

      console.log('\n✅ Reset completed successfully!');
      console.log('   The policies table now matches PolicyEntity schema.\n');

    } finally {
      await queryRunner.release();
    }

  } catch (error: any) {
    console.error('\n❌ Reset failed:', error?.message || error);
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

resetPoliciesTable().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

