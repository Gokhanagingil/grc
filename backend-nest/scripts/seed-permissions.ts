#!/usr/bin/env ts-node
/**
 * Permission Seed Script
 * 
 * Seeds basic permissions for the GRC platform
 * 
 * Usage: npm run seed:permissions
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { PermissionEntity } from '../src/entities/auth/permission.entity';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

// Permission definitions
const permissions = [
  // Admin permissions
  { code: 'ADMIN_PANEL_ACCESS', description: 'Access to admin panel' },
  { code: 'ROLE_ADMIN', description: 'Manage roles and permissions' },
  { code: 'USER_ADMIN', description: 'Manage users' },
  { code: 'DICTIONARY_ADMIN', description: 'Manage dictionaries' },
  
  // Policy permissions
  { code: 'POLICY_VIEW', description: 'View policies' },
  { code: 'POLICY_MANAGE', description: 'Create, update, and delete policies' },
  
  // Risk permissions
  { code: 'RISK_CATALOG_VIEW', description: 'View risk catalog' },
  { code: 'RISK_CATALOG_MANAGE', description: 'Manage risk catalog entries' },
  { code: 'RISK_REGISTER_VIEW', description: 'View risk register' },
  { code: 'RISK_REGISTER_MANAGE', description: 'Manage risk instances' },
  
  // Audit permissions
  { code: 'AUDIT_VIEW', description: 'View audit plans and engagements' },
  { code: 'AUDIT_MANAGE', description: 'Create and manage audits' },
  
  // BCM permissions
  { code: 'BCM_VIEW', description: 'View BIA processes and BCP plans' },
  { code: 'BCM_MANAGE', description: 'Manage BCM processes and plans' },
  
  // Entity permissions
  { code: 'ENTITY_VIEW', description: 'View entities' },
  { code: 'ENTITY_ADMIN', description: 'Manage entities' },
  
  // Calendar permissions
  { code: 'CALENDAR_VIEW', description: 'View calendar events' },
  { code: 'CALENDAR_ADMIN', description: 'Manage calendar events' },
  
  // Compliance permissions
  { code: 'COMPLIANCE_VIEW', description: 'View compliance requirements' },
  { code: 'COMPLIANCE_MANAGE', description: 'Manage compliance requirements' },
];

async function run() {
  const entities = [PermissionEntity];

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

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');
    console.log('🌱 Starting permission seed...\n');

    const permissionRepo = dataSource.getRepository(PermissionEntity);

    for (const permData of permissions) {
      let permission = await permissionRepo.findOne({
        where: { code: permData.code },
      });

      if (permission) {
        permission.description = permData.description;
        permission = await permissionRepo.save(permission);
        console.log(`✅ Updated permission: ${permData.code}`);
      } else {
        permission = permissionRepo.create({
          id: randomUUID(),
          code: permData.code,
          description: permData.description,
        });
        permission = await permissionRepo.save(permission);
        console.log(`✅ Created permission: ${permData.code}`);
      }
    }

    console.log(`\n✅ Permission seed completed: ${permissions.length} permissions`);
  } catch (error) {
    console.error('❌ Permission seed failed', error);
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

run();

