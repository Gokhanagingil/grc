#!/usr/bin/env ts-node
import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';

const email = 'test@local';
const password = 'test123';
const displayName = 'Test Admin';

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

    const sqliteRelative = process.env.DB_NAME || 'data/grc.sqlite';
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
    }
    return tenant;
  };

  const ensureAdminUser = async (ds: DataSource, tenantId: string) => {
    const userRepo = ds.getRepository(UserEntity);
    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
    const passwordHash = await bcrypt.hash(password, saltRounds);

    let user = await userRepo.findOne({
      where: { tenant_id: tenantId, email: email.toLowerCase() },
    });

    if (user) {
      user.password_hash = passwordHash;
      user.display_name = displayName;
      user.is_active = true;
      user.is_email_verified = true;
    } else {
      user = userRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        display_name: displayName,
        is_active: true,
        is_email_verified: true,
      });
    }

    await userRepo.save(user);
    console.log(`✅ Seeded admin login user: ${email}`);
  };

  const options = determineDataSourceOptions();
  const dataSource = new DataSource(options);

  try {
    await dataSource.initialize();
    const tenant = await ensureTenant(dataSource);
    await ensureAdminUser(dataSource, tenant.id);
    console.log('✅ Seed completed');
  } catch (error) {
    console.error('❌ Seed failed', error);
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

run();

