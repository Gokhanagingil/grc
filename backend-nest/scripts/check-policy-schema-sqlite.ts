#!/usr/bin/env ts-node
/**
 * Check SQLite policies table schema
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import * as path from 'path';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

async function main() {
  const sqliteFile = process.env.SQLITE_FILE || './data/grc.sqlite';
  const sqlitePath = path.isAbsolute(sqliteFile)
    ? sqliteFile
    : path.join(process.cwd(), sqliteFile);

  const dataSource = new DataSource({
    type: 'sqlite',
    database: sqlitePath,
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();

  try {
    const result = await dataSource.query("PRAGMA table_info(policies);");
    console.log('\n=== SQLite policies table schema ===');
    console.table(result);
    
    // Check for name column
    const hasName = result.some((col: any) => col.name === 'name');
    const hasTitle = result.some((col: any) => col.name === 'title');
    
    console.log(`\nHas 'name' column: ${hasName}`);
    console.log(`Has 'title' column: ${hasTitle}`);
    
    if (hasName) {
      const nameCol = result.find((col: any) => col.name === 'name');
      console.log(`\n'name' column details:`, nameCol);
    }
    if (hasTitle) {
      const titleCol = result.find((col: any) => col.name === 'title');
      console.log(`\n'title' column details:`, titleCol);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch(console.error);

