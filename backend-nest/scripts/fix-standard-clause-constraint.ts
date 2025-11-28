#!/usr/bin/env ts-node
/**
 * Fix StandardClause Unique Constraint
 * 
 * Drops and recreates standard_clause table with correct unique constraint
 * WARNING: This will DELETE all existing clause data in development environment
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { StandardClauseEntity } from '../src/entities/app/standard-clause.entity';
import { StandardEntity } from '../src/entities/app/standard.entity';
import { TenantEntity } from '../src/entities/tenant/tenant.entity';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

async function run() {
  const entities = [TenantEntity, StandardEntity, StandardClauseEntity];

  const determineDataSourceOptions = (): DataSourceOptions => {
    const dbDriver = (process.env.DB_DRIVER || '').toLowerCase();
    const databaseUrl = process.env.DATABASE_URL;
    const preferPostgres = dbDriver === 'postgres' || !!databaseUrl;

    if (preferPostgres) {
      console.log('⚠️  PostgreSQL detected. Manual migration required.');
      console.log('Please run: ALTER TABLE standard_clause DROP CONSTRAINT IF EXISTS idx_standard_clause_code_tenant;');
      console.log('Then restart backend to recreate with correct constraint.');
      process.exit(0);
    }

    const sqliteRelative = process.env.SQLITE_FILE || process.env.DB_NAME || 'data/grc.sqlite';
    const sqlitePath = path.isAbsolute(sqliteRelative)
      ? sqliteRelative
      : path.join(process.cwd(), sqliteRelative);

    return {
      type: 'sqlite',
      database: sqlitePath,
      logging: false,
      entities,
      synchronize: false,
    };
  };

  const options = determineDataSourceOptions();
  const dataSource = new DataSource(options);

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');
    console.log('SQLite file:', (dataSource.options as any).database);

    const queryRunner = dataSource.createQueryRunner();
    const tableExists = await queryRunner.hasTable('standard_clause');

    if (tableExists) {
      console.log('\n⚠️  WARNING: This will DELETE all existing clause data!');
      console.log('Dropping standard_clause table...');
      await queryRunner.dropTable('standard_clause', true, true);
      console.log('✅ standard_clause table dropped');
    } else {
      console.log('standard_clause table does not exist, no need to drop.');
    }

    console.log('\n✅ Constraint fix completed.');
    console.log('The standard_clause table will be recreated by TypeORM synchronize on next backend start.');
    console.log('Please restart the backend to apply the changes.');

  } catch (error) {
    console.error('❌ Constraint fix failed:', error);
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

run();

