#!/usr/bin/env ts-node
/**
 * Inspect SQLite schema - check for temporary tables and policies schema
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import * as path from 'path';
import { dbConfigFactory } from '../src/config/database.config';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

async function main() {
  const dbConfig = dbConfigFactory();
  
  if (dbConfig.type !== 'sqlite') {
    console.log('⚠️  This script is for SQLite only');
    return;
  }

  const sqlitePath = (dbConfig as any).database;
  console.log(`SQLite file: ${sqlitePath}\n`);

  const dataSource = new DataSource({
    ...dbConfig,
    synchronize: false,
  } as any);

  await dataSource.initialize();

  try {
    // Check all tables
    const allTables = await dataSource.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    console.log('=== All tables in database ===');
    console.table(allTables.map((t: any) => ({ name: t.name })));
    
    // Check for temporary_policies
    const tempTables = allTables.filter((t: any) => 
      t.name.toLowerCase().includes('temporary') || 
      t.name.toLowerCase().includes('_tmp') ||
      t.name.toLowerCase().includes('_temp')
    );
    
    if (tempTables.length > 0) {
      console.log('\n⚠️  Found temporary tables:');
      tempTables.forEach((t: any) => console.log(`  - ${t.name}`));
      
      // Inspect temporary_policies schema if it exists
      if (tempTables.some((t: any) => t.name.toLowerCase() === 'temporary_policies')) {
        console.log('\n=== temporary_policies schema ===');
        const tempSchema = await dataSource.query("PRAGMA table_info(temporary_policies)");
        console.table(tempSchema);
      }
    } else {
      console.log('\n✅ No temporary tables found');
    }
    
    // Check policies table
    console.log('\n=== policies table schema ===');
    const policiesSchema = await dataSource.query("PRAGMA table_info(policies)");
    console.table(policiesSchema);
    
  } finally {
    await dataSource.destroy();
  }
}

main().catch(console.error);

