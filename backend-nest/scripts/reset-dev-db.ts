#!/usr/bin/env ts-node
/**
 * Dev DB Reset Script
 * 
 * Resets the development SQLite database by:
 * 1. Creating a timestamped backup of the existing DB
 * 2. Deleting the old DB file
 * 3. Running migrations to create fresh schema
 * 4. Running seed scripts to populate initial data
 * 
 * IMPORTANT:
 * - Only works in development (NODE_ENV !== 'production')
 * - Only works with SQLite (dev environment)
 * - Never runs automatically (manual execution only)
 * 
 * Usage:
 *   npm run db:reset:dev
 *   OR
 *   ts-node -r tsconfig-paths/register scripts/reset-dev-db.ts
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { dbConfigFactory } from '../src/config/database.config';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

async function resetDevDb() {
  console.log('=== Dev DB Reset Pipeline ===\n');

  // Safety check: Only allow in development
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ This script cannot run in production environment!');
    console.error('   Set NODE_ENV to development or unset it.');
    process.exit(1);
  }

  // Get database configuration
  const dbConfig = dbConfigFactory();
  
  // Override migrationsRun to false since we'll run migrations manually
  (dbConfig as any).migrationsRun = false;
  
  // Safety check: Only allow SQLite
  if (dbConfig.type !== 'sqlite') {
    console.error('❌ This script only works with SQLite database!');
    console.error(`   Current DB type: ${dbConfig.type}`);
    console.error('   For Postgres, use migration:run and seed scripts manually.');
    process.exit(1);
  }

  const sqlitePath = (dbConfig as any).database;
  if (!sqlitePath) {
    console.error('❌ SQLite database path not found in configuration!');
    process.exit(1);
  }

  const absoluteDbPath = path.isAbsolute(sqlitePath)
    ? sqlitePath
    : path.join(process.cwd(), sqlitePath);

  console.log(`📋 Database: ${absoluteDbPath}`);
  console.log(`📋 Strategy: ${process.env.DB_STRATEGY || 'legacy-sync'}\n`);

  // Step 1: Backup existing DB if it exists
  if (fs.existsSync(absoluteDbPath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupDir = path.join(process.cwd(), 'data', 'backups');
    
    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log(`✅ Created backup directory: ${backupDir}`);
    }

    const backupFileName = `grc-dev-${timestamp}.sqlite`;
    const backupPath = path.join(backupDir, backupFileName);

    console.log('📦 Creating backup...');
    fs.copyFileSync(absoluteDbPath, backupPath);
    console.log(`✅ Backup created: ${backupPath}\n`);
  } else {
    console.log('ℹ️  No existing database found, skipping backup\n');
  }

  // Step 2: Delete old DB file
  if (fs.existsSync(absoluteDbPath)) {
    console.log('🗑️  Deleting old database...');
    try {
      fs.unlinkSync(absoluteDbPath);
      console.log('✅ Old database deleted\n');
    } catch (error: any) {
      if (error.code === 'EBUSY' || error.code === 'ENOENT') {
        console.log('⚠️  Database file is locked or already deleted, skipping deletion');
        console.log('   Will proceed with migrations on existing database\n');
      } else {
        throw error;
      }
    }
  }

  // Step 3: Run migrations
  console.log('📦 Running migrations...');
  try {
    // Create DataSource for migrations
    const dataSource = new DataSource(dbConfig as any);
    await dataSource.initialize();
    console.log('✅ Database connection established');

    // Run migrations
    const migrations = await dataSource.runMigrations();
    console.log(`✅ Migrations executed: ${migrations.length}`);
    
    if (migrations.length > 0) {
      console.log('   Executed migrations:');
      migrations.forEach((migration, index) => {
        console.log(`     ${index + 1}. ${migration.name}`);
      });
    } else {
      // Check if there are pending migrations
      const hasPendingMigrations = await dataSource.showMigrations();
      if (hasPendingMigrations) {
        console.log('⚠️  There are pending migrations that were not executed automatically.');
        console.log('   This might indicate all migrations are already applied.');
      } else {
        console.log('✅ No pending migrations reported by TypeORM.');
      }
    }

    // Verify tables were created
    const queryRunner = dataSource.createQueryRunner();
    const tables = await queryRunner.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    console.log(`\n📋 Tables created: ${tables.length}`);
    if (tables.length > 0 && tables.length <= 20) {
      tables.forEach((table: any) => {
        console.log(`   - ${table.name}`);
      });
    } else if (tables.length > 20) {
      console.log('   (too many tables to list)');
    }

    await queryRunner.release();
    await dataSource.destroy();
    console.log('');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    process.exit(1);
  }

  // Step 4: Run seed scripts
  console.log('🌱 Running seed scripts...');
  try {
    // Run seed:all which includes all necessary seeds
    execSync('npm run seed:all', {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });
    console.log('\n✅ Seed scripts completed');
  } catch (error: any) {
    console.error('\n❌ Seed failed:', error?.message || error);
    console.error('   Database schema is ready, but seed data may be incomplete.');
    console.error('   You can run seed scripts manually: npm run seed:all');
    // Don't exit - schema is ready even if seed fails
  }

  // Summary
  console.log('\n=== Reset Summary ===');
  console.log(`✅ Database reset completed`);
  console.log(`   Database: ${absoluteDbPath}`);
  if (fs.existsSync(absoluteDbPath)) {
    const stats = fs.statSync(absoluteDbPath);
    console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
  }
  console.log('\n📝 Next steps:');
  console.log('   1. Start the server: npm run start:dev');
  console.log('   2. Run smoke tests: npm run smoke:all');
  console.log('\n✅ Dev DB reset pipeline completed successfully!');
}

resetDevDb().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  if (error instanceof Error) {
    console.error('Stack:', error.stack);
  }
  process.exit(1);
});

