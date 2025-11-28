#!/usr/bin/env ts-node
/**
 * Test Baseline Migration
 * 
 * Tests the baseline migration on a fresh SQLite database
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/test-baseline-migration.ts
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { dbConfigFactory } from '../src/config/database.config';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

async function testBaselineMigration() {
  console.log('=== Testing Baseline Migration ===\n');

  // Create a test database file
  const testDbPath = path.join(process.cwd(), 'data', 'grc_migration_test.sqlite');
  const testDbDir = path.dirname(testDbPath);

  // Ensure data directory exists
  if (!fs.existsSync(testDbDir)) {
    fs.mkdirSync(testDbDir, { recursive: true });
  }

  // Remove existing test database if it exists
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
    console.log('✅ Removed existing test database');
  }

  // Create DataSource for test database
  const testConfig: DataSourceOptions = {
    type: 'sqlite',
    database: testDbPath,
    entities: [path.join(__dirname, '..', 'src', '**', '*.entity.ts')],
    migrations: [path.join(__dirname, '..', 'src', 'migrations', '20250126000000-baseline-grc-schema.ts')],
    synchronize: false, // Migration-first approach
    migrationsRun: false, // Manual run
    logging: true,
  };

  const dataSource = new DataSource(testConfig);

  try {
    // Initialize connection
    await dataSource.initialize();
    console.log('✅ Database connection established');
    console.log(`   Test DB: ${testDbPath}\n`);

    // Run migrations
    console.log('Running baseline migration...');
    const migrations = await dataSource.runMigrations();
    console.log(`✅ Migrations executed: ${migrations.length}\n`);

    // Verify tables were created
    const queryRunner = dataSource.createQueryRunner();
    const tables = await queryRunner.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    console.log('📋 Tables created:');
    tables.forEach((table: any) => {
      console.log(`   - ${table.name}`);
    });

    const expectedTables = [
      'tenants',
      'users',
      'roles',
      'permissions',
      'role_permissions',
      'user_roles',
      'refresh_tokens',
      'policies',
      'standard',
      'risk_category',
      'audit_logs',
    ];

    console.log(`\n✅ Total tables: ${tables.length}`);
    console.log(`   Expected: ${expectedTables.length}`);

    // Check if all expected tables exist
    const tableNames = tables.map((t: any) => t.name);
    const missingTables = expectedTables.filter((t) => !tableNames.includes(t));

    if (missingTables.length > 0) {
      console.log(`\n⚠️  Missing tables: ${missingTables.join(', ')}`);
    } else {
      console.log('\n✅ All expected tables created');
    }

    // Verify table structure (check tenants table as example)
    const tenantsInfo = await queryRunner.query('PRAGMA table_info(tenants)');
    console.log('\n📋 Tenants table structure:');
    tenantsInfo.forEach((col: any) => {
      console.log(`   - ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : 'NULL'} ${col.pk ? '[PK]' : ''}`);
    });

    // Verify indexes
    const indexes = await queryRunner.query(
      "SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
    );
    console.log(`\n📋 Indexes created: ${indexes.length}`);
    indexes.forEach((idx: any) => {
      console.log(`   - ${idx.name} on ${idx.tbl_name}`);
    });

    await queryRunner.release();

    console.log('\n✅ Baseline migration test completed successfully');
    console.log(`\nTest database location: ${testDbPath}`);
    console.log('You can inspect it with: sqlite3 data/grc_migration_test.sqlite');

  } catch (error) {
    console.error('\n❌ Error testing baseline migration:', error);
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

testBaselineMigration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

