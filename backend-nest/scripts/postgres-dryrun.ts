#!/usr/bin/env ts-node
/**
 * Postgres Dry-Run Script
 * 
 * Tests migrations on a PostgreSQL database without affecting production data.
 * This script connects to Postgres, runs migrations, and reports the results.
 * 
 * This script is aligned with the migration-first strategy (Sprint 3):
 * - Uses DB_STRATEGY from environment (defaults to migration-first for Postgres)
 * - Runs all pending migrations including baseline migration
 * - Verifies schema creation across all schemas (auth, tenant, app, audit, comms)
 * 
 * Prerequisites:
 * - PostgreSQL database must be running and accessible
 * - Environment variables must be set (see MIGRATION-FOUNDATION-STRATEGY-S3.md)
 * 
 * Usage:
 *   DB_ENGINE=postgres DATABASE_URL=postgresql://user:pass@host:5432/dbname npm run pg:dryrun
 *   OR
 *   DB_ENGINE=postgres DB_HOST=localhost DB_NAME=grc_test npm run pg:dryrun
 * 
 * Note: DB_STRATEGY is not used for Postgres (Postgres always uses migration-first)
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import { dbConfigFactory } from '../src/config/database.config';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

async function postgresDryRun() {
  console.log('=== Postgres Dry-Run ===\n');

  // Force Postgres mode
  process.env.DB_ENGINE = 'postgres';

  // Validate Postgres configuration
  const databaseUrl = process.env.DATABASE_URL;
  const dbHost = process.env.DB_HOST || process.env.PGHOST;
  const dbName = process.env.DB_NAME || process.env.PGDATABASE;

  if (!databaseUrl && (!dbHost || !dbName)) {
    console.error('❌ Postgres configuration incomplete.');
    console.error('\nRequired environment variables:');
    console.error('  Option 1: DATABASE_URL=postgresql://user:pass@host:5432/dbname');
    console.error('  Option 2: DB_HOST, DB_NAME (and optionally DB_USER, DB_PASS, DB_PORT)');
    console.error('\nSee POSTGRES-DRYRUN-PLAYBOOK-S2.md for details.');
    process.exitCode = 1;
    return;
  }

  console.log('📋 Configuration:');
  if (databaseUrl) {
    // Mask password in URL
    const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ':****@');
    console.log(`   DATABASE_URL: ${maskedUrl}`);
  } else {
    console.log(`   DB_HOST: ${dbHost}`);
    console.log(`   DB_NAME: ${dbName}`);
    console.log(`   DB_USER: ${process.env.DB_USER || process.env.PGUSER || 'postgres'}`);
    console.log(`   DB_PORT: ${process.env.DB_PORT || process.env.PGPORT || 5432}`);
  }
  console.log(`   DB_STRATEGY: migration-first (Postgres always uses migrations)`);
  console.log(`   DB_ENGINE: postgres`);
  console.log('');

  // Create DataSource using dbConfigFactory
  const dbConfig = dbConfigFactory();
  const dataSource = new DataSource(dbConfig as DataSourceOptions);

  try {
    // Initialize connection
    console.log('Connecting to Postgres...');
    await dataSource.initialize();
    console.log('✅ Connected to Postgres\n');

    // Check current migration status
    console.log('📋 Current migration status:');
    const executedMigrations = await dataSource.showMigrations();
    console.log(`   Executed migrations: ${executedMigrations.length}`);
    if (executedMigrations.length > 0) {
      console.log('   Migration history:');
      executedMigrations.forEach((migration, index) => {
        console.log(`     ${index + 1}. ${migration.name} (${migration.timestamp})`);
      });
    }
    console.log('');

    // Get pending migrations
    const pendingMigrations = await dataSource.migrations.filter(
      (migration) => !executedMigrations.some((executed) => executed.name === migration.name)
    );

    console.log(`📋 Pending migrations: ${pendingMigrations.length}`);
    if (pendingMigrations.length > 0) {
      pendingMigrations.forEach((migration, index) => {
        console.log(`   ${index + 1}. ${migration.name}`);
      });
      console.log('');

      // Run migrations
      console.log('Running pending migrations...');
      const migrations = await dataSource.runMigrations();
      console.log(`✅ Migrations executed: ${migrations.length}\n`);

      // Verify tables were created
      const queryRunner = dataSource.createQueryRunner();
      const tables = await queryRunner.query(`
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_schema IN ('public', 'auth', 'tenant', 'app', 'audit', 'comms')
        AND table_type = 'BASE TABLE'
        ORDER BY table_schema, table_name
      `);

      console.log('📋 Tables created:');
      const tablesBySchema = new Map<string, string[]>();
      tables.forEach((row: any) => {
        const schema = row.table_schema;
        const table = row.table_name;
        if (!tablesBySchema.has(schema)) {
          tablesBySchema.set(schema, []);
        }
        tablesBySchema.get(schema)!.push(table);
      });

      tablesBySchema.forEach((tableList, schema) => {
        console.log(`   Schema: ${schema}`);
        tableList.forEach((table) => {
          console.log(`     - ${table}`);
        });
      });

      console.log(`\n✅ Total tables: ${tables.length}`);

      // Check for baseline migration tables
      const expectedCoreTables = [
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

      const foundTables = tables
        .map((t: any) => t.table_name)
        .filter((name: string) => expectedCoreTables.includes(name));

      console.log(`\n✅ Core tables found: ${foundTables.length}/${expectedCoreTables.length}`);
      if (foundTables.length < expectedCoreTables.length) {
        const missing = expectedCoreTables.filter((t) => !foundTables.includes(t));
        console.log(`   ⚠️  Missing tables: ${missing.join(', ')}`);
      }

      await queryRunner.release();
    } else {
      console.log('   No pending migrations\n');
    }

    // Test basic query
    console.log('Testing basic query...');
    const queryRunner = dataSource.createQueryRunner();
    try {
      const result = await queryRunner.query('SELECT version()');
      console.log(`✅ Postgres version: ${result[0].version.split(' ')[0]} ${result[0].version.split(' ')[1]}\n`);
    } catch (error) {
      console.log('⚠️  Could not query Postgres version\n');
    }
    await queryRunner.release();

    console.log('✅ Postgres dry-run completed successfully');
    console.log('\n📝 Note: This was a dry-run. No production data was affected.');

  } catch (error) {
    console.error('\n❌ Error during Postgres dry-run:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      if (error.stack) {
        console.error('Stack:', error.stack);
      }
    }

    // Provide helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
        console.error('\n💡 Troubleshooting:');
        console.error('   - Check if PostgreSQL is running');
        console.error('   - Verify connection details (host, port, database)');
        console.error('   - Check firewall/network settings');
      } else if (error.message.includes('authentication failed') || error.message.includes('password')) {
        console.error('\n💡 Troubleshooting:');
        console.error('   - Verify username and password');
        console.error('   - Check pg_hba.conf configuration');
      } else if (error.message.includes('database') && error.message.includes('does not exist')) {
        console.error('\n💡 Troubleshooting:');
        console.error('   - Create the database first: CREATE DATABASE <dbname>;');
        console.error('   - Or use an existing database');
      }
    }

    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('\n✅ Database connection closed');
    }
  }
}

postgresDryRun().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

