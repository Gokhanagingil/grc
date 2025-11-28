#!/usr/bin/env ts-node
/**
 * Seed Dev Users Script
 * 
 * Creates canonical demo tenant and users for development and smoke tests.
 * 
 * Canonical Model:
 * - Tenant ID: 217492b2-f814-4ba0-ae50-4e4f8ecf6216 (fixed GUID)
 * - User 1: grc1@local / grc1 (roles: ['admin', 'user'])
 * - User 2: grc2@local / grc2 (roles: ['user'])
 * 
 * This script is idempotent: it can be run multiple times safely.
 * If tenant/users exist, they will be updated to match the canonical model.
 * 
 * Usage: npm run seed:dev-users
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

// Canonical demo tenant ID (used across all smoke tests and seed scripts)
const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';

// Canonical demo users (aligned with login smoke tests)
const users = [
  {
    email: 'grc1@local',
    password: 'grc1',
    displayName: 'GRC Admin User',
    roles: ['admin', 'user'], // Admin + user roles (used by login smoke tests)
  },
  {
    email: 'grc2@local',
    password: 'grc2',
    displayName: 'GRC Regular User',
    roles: ['user'], // Regular user only (for future role-based tests)
  },
];

async function run() {
  const { TenantEntity } = await import('../src/entities/tenant/tenant.entity');
  const { UserEntity } = await import('../src/entities/auth/user.entity');
  const entities = [TenantEntity, UserEntity];

  const determineDataSourceOptions = (): DataSourceOptions => {
    const dbDriver = (process.env.DB_DRIVER || '').toLowerCase();
    const databaseUrl = process.env.DATABASE_URL;
    const preferPostgres = dbDriver === 'postgres' || !!databaseUrl;
    const synchronizeEnv =
      (process.env.DB_SYNCHRONIZE || '').toLowerCase() === 'true';

    if (preferPostgres) {
      return {
        type: 'postgres',
        url: databaseUrl,
        host: databaseUrl
          ? undefined
          : process.env.DB_HOST || process.env.PGHOST || 'localhost',
        port: databaseUrl
          ? undefined
          : Number(process.env.DB_PORT || process.env.PGPORT || 5432),
        username: databaseUrl
          ? undefined
          : process.env.DB_USER || process.env.PGUSER || 'postgres',
        password: databaseUrl
          ? undefined
          : process.env.DB_PASS || process.env.PGPASSWORD || 'postgres',
        database: databaseUrl
          ? undefined
          : process.env.DB_NAME || process.env.PGDATABASE || 'postgres',
        schema: process.env.DB_SCHEMA || 'public',
        logging: false,
        entities,
        synchronize: synchronizeEnv,
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
      synchronize: false, // Use migrations, not synchronize
    };
  };

  const ensureTenant = async (ds: DataSource) => {
    const tenantRepo = ds.getRepository(TenantEntity);
    let tenant = await tenantRepo.findOne({ where: { id: DEFAULT_TENANT_ID } });
    if (!tenant) {
      tenant = tenantRepo.create({
        id: DEFAULT_TENANT_ID,
        name: 'Default Tenant',
        slug: 'default',
        is_active: true,
      });
      tenant = await tenantRepo.save(tenant);
      console.log(`✅ Created tenant: ${tenant.id} (${tenant.name})`);
    } else {
      // Ensure tenant is active (idempotent update)
      if (!tenant.is_active) {
        tenant.is_active = true;
        tenant = await tenantRepo.save(tenant);
        console.log(`✅ Activated tenant: ${tenant.id} (${tenant.name})`);
      } else {
        console.log(`✅ Tenant exists: ${tenant.id} (${tenant.name})`);
      }
    }
    return tenant;
  };

  const ensureUser = async (
    ds: DataSource,
    tenantId: string,
    userData: typeof users[0],
  ) => {
    const userRepo = ds.getRepository(UserEntity);
    // Use same bcrypt library and salt rounds as auth service
    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
    const passwordHash = await bcrypt.hash(userData.password, saltRounds);

    const emailLower = userData.email.toLowerCase();
    let user = await userRepo.findOne({
      where: { tenant_id: tenantId, email: emailLower },
    });

    if (user) {
      // Idempotent update: ensure user matches canonical model
      const needsUpdate =
        user.password_hash !== passwordHash ||
        user.display_name !== userData.displayName ||
        JSON.stringify(user.roles || []) !== JSON.stringify(userData.roles || []) ||
        !user.is_active ||
        !user.is_email_verified ||
        (user.failed_attempts || 0) > 0 ||
        user.locked_until !== null;

      if (needsUpdate) {
        user.password_hash = passwordHash;
        user.display_name = userData.displayName;
        user.roles = userData.roles || ['user'];
        user.is_active = true;
        user.is_email_verified = true;
        user.failed_attempts = 0;
        user.locked_until = undefined;
        await userRepo.save(user);
        console.log(`✅ Updated user: ${emailLower} (roles: ${JSON.stringify(userData.roles)})`);
      } else {
        console.log(`✅ User exists: ${emailLower} (roles: ${JSON.stringify(userData.roles)})`);
      }
    } else {
      // Create new user
      user = userRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        email: emailLower,
        password_hash: passwordHash,
        display_name: userData.displayName,
        roles: userData.roles || ['user'],
        is_active: true,
        is_email_verified: true,
        failed_attempts: 0,
        locked_until: undefined,
      });
      await userRepo.save(user);
      console.log(`✅ Created user: ${emailLower} (roles: ${JSON.stringify(userData.roles)})`);
    }
  };

  const options = determineDataSourceOptions();
  const dataSource = new DataSource(options);

  try {
    console.log('🌱 Starting seed:dev-users...');
    console.log(`   Tenant ID: ${DEFAULT_TENANT_ID}`);
    console.log(`   Users to seed: ${users.length}`);
    console.log('');

    await dataSource.initialize();
    console.log('✅ Database connected');

    const tenant = await ensureTenant(dataSource);
    console.log('');

    for (const userData of users) {
      await ensureUser(dataSource, tenant.id, userData);
    }

    console.log('');
    console.log('✅ Seed completed successfully');
    console.log(`   Tenant: ${tenant.id} (${tenant.name})`);
    console.log(`   Users: ${users.map(u => u.email).join(', ')}`);
  } catch (error) {
    console.error('');
    console.error('❌ Seed failed:', error);
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

