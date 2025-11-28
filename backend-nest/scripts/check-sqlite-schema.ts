#!/usr/bin/env ts-node
/**
 * Check SQLite Schema
 * Inspects the actual SQLite database schema for analysis
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

function determineDataSourceOptions(): DataSourceOptions {
  const sqliteRelative = process.env.SQLITE_FILE || process.env.DB_NAME || 'data/grc.sqlite';
  const sqlitePath = path.isAbsolute(sqliteRelative)
    ? sqliteRelative
    : path.join(process.cwd(), sqliteRelative);

  return {
    type: 'sqlite',
    database: sqlitePath,
    logging: false,
    synchronize: false,
  };
}

async function checkSchema() {
  const options = determineDataSourceOptions();
  const dataSource = new DataSource(options);

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');
    console.log(`SQLite file: ${(options as any).database}\n`);

    const queryRunner = dataSource.createQueryRunner();

    // Check if policies table exists
    const tableExists = await queryRunner.query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='policies'`
    );

    if (tableExists.length === 0) {
      console.log('⚠️  policies table does not exist.');
      await queryRunner.release();
      return;
    }

    console.log('📋 Policies Table Schema:');
    console.log('='.repeat(60));
    const tableInfo = await queryRunner.query(`PRAGMA table_info(policies)`);
    console.log(JSON.stringify(tableInfo, null, 2));
    console.log('='.repeat(60));

    // Check indexes
    console.log('\n📋 Policies Table Indexes:');
    console.log('='.repeat(60));
    const indexes = await queryRunner.query(
      `SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='policies'`
    );
    console.log(JSON.stringify(indexes, null, 2));
    console.log('='.repeat(60));

    // Check policy_standards table if exists
    const policyStandardsExists = await queryRunner.query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='policy_standards'`
    );

    if (policyStandardsExists.length > 0) {
      console.log('\n📋 Policy Standards Table Schema:');
      console.log('='.repeat(60));
      const policyStandardsInfo = await queryRunner.query(`PRAGMA table_info(policy_standards)`);
      console.log(JSON.stringify(policyStandardsInfo, null, 2));
      console.log('='.repeat(60));
    }

    await queryRunner.release();
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

