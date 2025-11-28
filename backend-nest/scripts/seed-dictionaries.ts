#!/usr/bin/env ts-node
import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';

// Dictionary entries to seed
const dictionaries = [
  // POLICY_STATUS domain
  {
    domain: 'POLICY_STATUS',
    code: 'draft',
    label: 'Draft',
    description: 'Policy is in draft status',
    order: 1,
    isActive: true,
  },
  {
    domain: 'POLICY_STATUS',
    code: 'approved',
    label: 'Approved',
    description: 'Policy is approved and active',
    order: 2,
    isActive: true,
  },
  {
    domain: 'POLICY_STATUS',
    code: 'retired',
    label: 'Retired',
    description: 'Policy is retired and no longer active',
    order: 3,
    isActive: true,
  },
  // REQUIREMENT_CATEGORY domain
  {
    domain: 'REQUIREMENT_CATEGORY',
    code: 'legal',
    label: 'Legal',
    description: 'Legal and regulatory requirements',
    order: 1,
    isActive: true,
  },
  {
    domain: 'REQUIREMENT_CATEGORY',
    code: 'technical',
    label: 'Technical',
    description: 'Technical and security requirements',
    order: 2,
    isActive: true,
  },
  {
    domain: 'REQUIREMENT_CATEGORY',
    code: 'business',
    label: 'Business',
    description: 'Business and operational requirements',
    order: 3,
    isActive: true,
  },
  {
    domain: 'REQUIREMENT_CATEGORY',
    code: 'compliance',
    label: 'Compliance',
    description: 'Compliance and audit requirements',
    order: 4,
    isActive: true,
  },
  // POLICY_CATEGORY domain
  {
    domain: 'POLICY_CATEGORY',
    code: 'INFOSEC',
    label: 'Information Security',
    description: 'Information security policies',
    order: 1,
    isActive: true,
  },
  {
    domain: 'POLICY_CATEGORY',
    code: 'BCM',
    label: 'Business Continuity',
    description: 'Business continuity management policies',
    order: 2,
    isActive: true,
  },
  {
    domain: 'POLICY_CATEGORY',
    code: 'PRIVACY',
    label: 'Data Protection & Privacy',
    description: 'Data protection and privacy policies',
    order: 3,
    isActive: true,
  },
  {
    domain: 'POLICY_CATEGORY',
    code: 'HR',
    label: 'HR Security',
    description: 'Human resources security policies',
    order: 4,
    isActive: true,
  },
  {
    domain: 'POLICY_CATEGORY',
    code: 'THIRD_PARTY',
    label: 'Third Party Management',
    description: 'Third party and vendor management policies',
    order: 5,
    isActive: true,
  },
  {
    domain: 'POLICY_CATEGORY',
    code: 'PHYSICAL',
    label: 'Physical & Environmental Security',
    description: 'Physical and environmental security policies',
    order: 6,
    isActive: true,
  },
  {
    domain: 'POLICY_CATEGORY',
    code: 'CHANGE',
    label: 'Change & Release Management',
    description: 'Change and release management policies',
    order: 7,
    isActive: true,
  },
  {
    domain: 'POLICY_CATEGORY',
    code: 'INCIDENT',
    label: 'Incident & Problem Management',
    description: 'Incident and problem management policies',
    order: 8,
    isActive: true,
  },
  {
    domain: 'POLICY_CATEGORY',
    code: 'ACCESS',
    label: 'Access Control',
    description: 'Access control policies',
    order: 9,
    isActive: true,
  },
  {
    domain: 'POLICY_CATEGORY',
    code: 'ASSET',
    label: 'Asset Management',
    description: 'Asset management policies',
    order: 10,
    isActive: true,
  },
];

async function run() {
  const { DictionaryEntity } = await import('../src/entities/app/dictionary.entity');
  const { TenantEntity } = await import('../src/entities/tenant/tenant.entity');
  const entities = [DictionaryEntity, TenantEntity];

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
      console.log(`✅ Created tenant: ${tenant.id}`);
    } else {
      console.log(`✅ Tenant exists: ${tenant.id}`);
    }
    return tenant;
  };

  const ensureDictionary = async (
    ds: DataSource,
    tenantId: string,
    dictData: typeof dictionaries[0],
  ) => {
    const dictRepo = ds.getRepository(DictionaryEntity);

    let dict = await dictRepo.findOne({
      where: {
        tenant_id: tenantId,
        domain: dictData.domain,
        code: dictData.code,
      },
    });

    if (dict) {
      dict.label = dictData.label;
      dict.description = dictData.description;
      dict.order = dictData.order;
      dict.is_active = dictData.isActive;
      await dictRepo.save(dict);
      console.log(`✅ Updated dictionary: ${dictData.domain}/${dictData.code}`);
    } else {
      dict = dictRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        domain: dictData.domain,
        code: dictData.code,
        label: dictData.label,
        description: dictData.description,
        order: dictData.order,
        is_active: dictData.isActive,
        meta: {},
      });
      await dictRepo.save(dict);
      console.log(`✅ Created dictionary: ${dictData.domain}/${dictData.code}`);
    }
  };

  const options = determineDataSourceOptions();
  const dataSource = new DataSource(options);

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');
    const tenant = await ensureTenant(dataSource);
    for (const dictData of dictionaries) {
      await ensureDictionary(dataSource, tenant.id, dictData);
    }
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

