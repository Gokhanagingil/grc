#!/usr/bin/env ts-node
/**
 * Check Policy Table Schema
 * Compares PolicyEntity with actual SQLite schema
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { PolicyEntity } from '../src/entities/app/policy.entity';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

function determineDataSourceOptions(): DataSourceOptions {
  const dbDriver = (process.env.DB_DRIVER || '').toLowerCase();
  const databaseUrl = process.env.DATABASE_URL;
  const preferPostgres = dbDriver === 'postgres' || !!databaseUrl;

  if (preferPostgres) {
    return {
      type: 'postgres',
      url: databaseUrl,
      host: databaseUrl ? undefined : process.env.DB_HOST || 'localhost',
      port: databaseUrl ? undefined : Number(process.env.DB_PORT || 5432),
      username: databaseUrl ? undefined : process.env.DB_USER || 'postgres',
      password: databaseUrl ? undefined : process.env.DB_PASS || 'postgres',
      database: databaseUrl ? undefined : process.env.DB_NAME || 'postgres',
      schema: process.env.DB_SCHEMA || 'public',
      logging: false,
      entities: [PolicyEntity],
      synchronize: false,
    };
  }

  const sqliteRelative = process.env.SQLITE_FILE || process.env.DB_NAME || 'data/grc.sqlite';
  const sqlitePath = path.isAbsolute(sqliteRelative)
    ? sqliteRelative
    : path.join(process.cwd(), sqliteRelative);

  return {
    type: 'sqlite',
    database: sqlitePath,
    logging: false,
    entities: [PolicyEntity],
    synchronize: false,
  };
}

async function checkSchema() {
  const options = determineDataSourceOptions();
  const dataSource = new DataSource(options);

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');
    console.log(`Database type: ${options.type}`);
    if (options.type === 'sqlite') {
      console.log(`SQLite file: ${(options as any).database}`);
    }

    if (options.type !== 'sqlite') {
      console.log('⚠️  This script is designed for SQLite. Skipping schema check.');
      return;
    }

    // Get actual table schema
    const queryRunner = dataSource.createQueryRunner();
    const tableInfo = await queryRunner.query(`PRAGMA table_info(policies)`);
    await queryRunner.release();

    console.log('\n=== Actual SQLite Schema (policies table) ===');
    console.table(tableInfo);

    // Get entity metadata
    const metadata = dataSource.getMetadata(PolicyEntity);
    console.log('\n=== Entity Metadata (PolicyEntity) ===');
    console.log('Table name:', metadata.tableName);
    console.log('\nColumns:');
    metadata.columns.forEach((col) => {
      console.log(`  - ${col.propertyName}:`);
      console.log(`      type: ${col.type}`);
      console.log(`      nullable: ${col.isNullable}`);
      console.log(`      default: ${col.default}`);
      console.log(`      dbName: ${col.databaseName}`);
    });

    // Compare
    console.log('\n=== Schema Comparison ===');
    const entityColumns = new Map(
      metadata.columns.map((col) => [col.databaseName.toLowerCase(), col]),
    );
    const dbColumns = new Map(
      tableInfo.map((col: any) => [col.name.toLowerCase(), col]),
    );

    // Check missing columns in DB
    console.log('\n❌ Columns in Entity but NOT in DB:');
    let missingInDb = false;
    for (const [name, col] of entityColumns) {
      if (!dbColumns.has(name)) {
        console.log(`  - ${col.databaseName} (${col.type}, nullable: ${col.isNullable})`);
        missingInDb = true;
      }
    }
    if (!missingInDb) {
      console.log('  (none)');
    }

    // Check extra columns in DB
    console.log('\n⚠️  Columns in DB but NOT in Entity:');
    let extraInDb = false;
    for (const [name, col] of dbColumns) {
      if (!entityColumns.has(name as string)) {
        const dbCol = col as any;
        console.log(`  - ${dbCol.name} (${dbCol.type})`);
        extraInDb = true;
      }
    }
    if (!extraInDb) {
      console.log('  (none)');
    }

    // Check NOT NULL constraints
    console.log('\n⚠️  NOT NULL columns without defaults:');
    let notNullIssues = false;
    for (const [name, col] of entityColumns) {
      const dbCol = dbColumns.get(name) as any;
      if (dbCol && !col.isNullable && !col.default && dbCol.notnull === 1) {
        console.log(`  - ${col.databaseName} (required in both Entity and DB)`);
        notNullIssues = true;
      }
    }
    if (!notNullIssues) {
      console.log('  (none)');
    }

    console.log('\n✅ Schema check completed');
  } catch (error: any) {
    console.error('❌ Schema check failed:', error?.message || error);
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

checkSchema();

