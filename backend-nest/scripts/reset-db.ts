#!/usr/bin/env ts-node

/**
 * Database Reset Script with Optional Seed
 * Usage: ts-node scripts/reset-db.ts [--with-seed]
 */

import { execSync } from 'child_process';
import { config } from 'dotenv';

config();

const withSeed = process.argv.includes('--with-seed');

async function reset() {
  console.log('🔄 Resetting database...');

  try {
    // Run migrations (revert if needed, then run)
    console.log('📦 Running migrations...');
    execSync('npm run migration:run', { stdio: 'inherit', cwd: process.cwd() });

    if (withSeed) {
      console.log('🌱 Running test seed...');
      execSync('npm run test-seed', {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      console.log('🌱 Running Phase 12 demo seed...');
      execSync('npm run demo-seed:phase12', {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      console.log('🌱 Running Phase 14 audit seed...');
      try {
        execSync('npm run demo-seed:phase14', {
          stdio: 'inherit',
          cwd: process.cwd(),
        });
      } catch (error: any) {
        console.warn('⚠️  Phase 14 seed skipped:', error?.message);
      }
      console.log('🌱 Running Phase 15 BCM seed...');
      try {
        execSync('npm run demo-seed:phase15', {
          stdio: 'inherit',
          cwd: process.cwd(),
        });
      } catch (error: any) {
        console.warn('⚠️  Phase 15 seed skipped:', error?.message);
      }
      console.log('✅ Database reset with seed completed');
    } else {
      console.log('✅ Database reset completed (no seed)');
    }
  } catch (error: any) {
    console.error('❌ Reset failed:', error.message);
    process.exit(1);
  }
}

reset();

