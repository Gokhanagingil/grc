#!/usr/bin/env ts-node
/**
 * DB Probe - Tests PostgreSQL connection using TypeORM
 * Exits with code 0 on success, 2 on failure
 */

import 'reflect-metadata';
import AppDataSource from '../src/data-source';

console.log('🔍 Testing PostgreSQL connection...');
console.log(`   Host: ${process.env.DB_HOST || process.env.PGHOST || 'localhost'}`);
console.log(`   Port: ${process.env.DB_PORT || process.env.PGPORT || 5432}`);
console.log(`   Database: ${process.env.DB_NAME || process.env.PGDATABASE || 'grc'}`);
console.log(`   User: ${process.env.DB_USER || process.env.PGUSER || 'grc'}`);

async function probe() {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    console.log('✅ Connected to PostgreSQL');

    // Test query 1
    const result1 = await AppDataSource.query('SELECT 1 as test');
    if (result1[0]?.test === 1) {
      console.log('✅ SELECT 1 query successful');
    } else {
      console.error('❌ SELECT 1 query returned unexpected result');
      process.exit(2);
    }

    // Test query 2
    const result2 = await AppDataSource.query('SELECT NOW() as current_time');
    if (result2[0]?.current_time) {
      console.log(`✅ SELECT NOW() query successful: ${result2[0].current_time}`);
    } else {
      console.error('❌ SELECT NOW() query returned unexpected result');
      process.exit(2);
    }

    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    console.log('✅ DB OK');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ DB connection failed:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code || 'N/A'}`);
    if (AppDataSource.isInitialized) {
      try {
        await AppDataSource.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
    process.exit(2);
  }
}

probe().catch((err) => {
  console.error('❌ Unhandled error:', err);
  process.exit(2);
});
