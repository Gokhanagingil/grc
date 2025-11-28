#!/usr/bin/env ts-node
/**
 * Smoke Test for Calendar Module
 * 
 * Verifies that calendar events are accessible and working correctly.
 * 
 * Usage: npm run smoke:calendar
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { CalendarEventEntity } from '../src/entities/app/calendar-event.entity';
import { TenantEntity } from '../src/entities/tenant/tenant.entity';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';

interface SmokeTestResult {
  name: string;
  passed: boolean;
  message?: string;
}

async function run() {
  const entities = [CalendarEventEntity, TenantEntity];

  const determineDataSourceOptions = (): DataSourceOptions => {
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
        entities,
        synchronize: false,
        migrationsRun: false,
      };
    }

    const sqliteRelative = process.env.SQLITE_FILE || process.env.DB_NAME || 'data/grc.sqlite';
    const sqlitePath = path.isAbsolute(sqliteRelative)
      ? sqliteRelative
      : path.join(process.cwd(), sqliteRelative);
    fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });

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

  const results: SmokeTestResult[] = [];

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');
    console.log('🔍 Running smoke tests for calendar module...\n');

    // Test 1: Calendar events table exists
    try {
      const queryRunner = dataSource.createQueryRunner();
      const tables = await queryRunner.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='calendar_events';"
      );
      await queryRunner.release();

      if (tables.length > 0) {
        results.push({
          name: 'Calendar Events Table Exists',
          passed: true,
          message: '✅ calendar_events table exists',
        });
      } else {
        results.push({
          name: 'Calendar Events Table Exists',
          passed: false,
          message: '❌ calendar_events table does not exist',
        });
      }
    } catch (error: any) {
      results.push({
        name: 'Calendar Events Table Exists',
        passed: false,
        message: `❌ Error checking table: ${error?.message || error}`,
      });
    }

    // Test 2: Calendar events can be queried
    try {
      const calendarRepo = dataSource.getRepository(CalendarEventEntity);
      const eventCount = await calendarRepo.count({
        where: { tenant_id: DEFAULT_TENANT_ID },
      });

      results.push({
        name: 'Calendar Events Query',
        passed: true,
        message: `✅ Can query calendar events (found ${eventCount} events)`,
      });
    } catch (error: any) {
      results.push({
        name: 'Calendar Events Query',
        passed: false,
        message: `❌ Error querying calendar events: ${error?.message || error}`,
      });
    }

    // Test 3: Calendar events exist (at least 1)
    try {
      const calendarRepo = dataSource.getRepository(CalendarEventEntity);
      const eventCount = await calendarRepo.count({
        where: { tenant_id: DEFAULT_TENANT_ID },
      });

      results.push({
        name: 'Calendar Events Exist',
        passed: eventCount >= 1,
        message: eventCount >= 1
          ? `✅ Found ${eventCount} calendar event(s)`
          : `❌ No calendar events found (expected at least 1)`,
      });
    } catch (error: any) {
      results.push({
        name: 'Calendar Events Exist',
        passed: false,
        message: `❌ Error counting calendar events: ${error?.message || error}`,
      });
    }

    // Test 4: Calendar events with date range query
    try {
      const calendarRepo = dataSource.getRepository(CalendarEventEntity);
      const now = new Date();
      const futureDate = new Date(now);
      futureDate.setDate(futureDate.getDate() + 90);

      // Use Between for date range query
      const { Between } = await import('typeorm');
      const events = await calendarRepo.find({
        where: {
          tenant_id: DEFAULT_TENANT_ID,
          start_at: Between(now, futureDate),
        },
        take: 10,
      });

      results.push({
        name: 'Calendar Events Date Range Query',
        passed: true,
        message: `✅ Can query calendar events by date range (found ${events.length} events in next 90 days)`,
      });
    } catch (error: any) {
      // This might fail if the query syntax is wrong, but that's okay - we'll catch it
      results.push({
        name: 'Calendar Events Date Range Query',
        passed: false,
        message: `❌ Error querying by date range: ${error?.message || error}`,
      });
    }

    // Print results
    console.log('📊 Calendar Smoke Test Results:\n');
    let allPassed = true;
    for (const result of results) {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.name}: ${result.message || ''}`);
      if (!result.passed) {
        allPassed = false;
      }
    }

    console.log('\n' + '='.repeat(50));
    if (allPassed) {
      console.log('✅ All calendar smoke tests PASSED');
    process.exitCode = 0;
    } else {
      console.log('❌ Some calendar smoke tests FAILED');
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('❌ Calendar smoke test failed', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      if (error.stack) {
        console.error('   Stack:', error.stack);
      }
    }
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

run();
