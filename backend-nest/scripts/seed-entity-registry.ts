#!/usr/bin/env ts-node
/**
 * Seed Entity Registry
 * 
 * Seeds entity types and entities (applications, databases, vendors, etc.)
 * 
 * Usage: npm run seed:entity-registry
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { EntityTypeEntity } from '../src/entities/app/entity-type.entity';
import { EntityEntity } from '../src/entities/app/entity.entity';
import { TenantEntity } from '../src/entities/tenant/tenant.entity';
import { UserEntity } from '../src/entities/auth/user.entity';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';

// Entity types
const entityTypes = [
  { code: 'APPLICATION', name: 'Application', description: 'Software applications and systems' },
  { code: 'DATABASE', name: 'Database', description: 'Database systems and data stores' },
  { code: 'INFRASTRUCTURE', name: 'Infrastructure', description: 'Network, server, and infrastructure components' },
  { code: 'VENDOR', name: 'Vendor', description: 'Third-party vendors and service providers' },
  { code: 'BUSINESS_SERVICE', name: 'Business Service', description: 'Business services and processes' },
  { code: 'DEPARTMENT', name: 'Department', description: 'Organizational departments' },
];

// Entities
const entities = [
  // Applications
  {
    code: 'APP-CRM',
    name: 'Customer Relationship Management System',
    entityTypeCode: 'APPLICATION',
    criticality: 5,
    attributes: { tier: 'Tier 1', vendor: 'Salesforce', version: '2024.1' },
  },
  {
    code: 'APP-ERP',
    name: 'Enterprise Resource Planning System',
    entityTypeCode: 'APPLICATION',
    criticality: 5,
    attributes: { tier: 'Tier 1', vendor: 'SAP', version: 'S/4HANA 2023' },
  },
  {
    code: 'APP-COREBANK',
    name: 'Core Banking System',
    entityTypeCode: 'APPLICATION',
    criticality: 5,
    attributes: { tier: 'Tier 1', vendor: 'Temenos', version: 'T24 R21' },
  },
  {
    code: 'APP-IBANK',
    name: 'Internet Banking Platform',
    entityTypeCode: 'APPLICATION',
    criticality: 5,
    attributes: { tier: 'Tier 1', vendor: 'Internal', version: '2.5.0' },
  },
  {
    code: 'APP-HRMS',
    name: 'Human Resources Management System',
    entityTypeCode: 'APPLICATION',
    criticality: 4,
    attributes: { tier: 'Tier 2', vendor: 'Workday', version: '2024.1' },
  },
  // Databases
  {
    code: 'DB-CUSTOMER',
    name: 'Customer Database',
    entityTypeCode: 'DATABASE',
    criticality: 5,
    attributes: { tier: 'Tier 1', dbType: 'PostgreSQL', version: '15.2' },
  },
  {
    code: 'DB-TRANSACTION',
    name: 'Transaction Database',
    entityTypeCode: 'DATABASE',
    criticality: 5,
    attributes: { tier: 'Tier 1', dbType: 'Oracle', version: '19c' },
  },
  {
    code: 'DB-ANALYTICS',
    name: 'Analytics Data Warehouse',
    entityTypeCode: 'DATABASE',
    criticality: 4,
    attributes: { tier: 'Tier 2', dbType: 'Snowflake', version: '8.0' },
  },
  // Infrastructure
  {
    code: 'INFRA-DC-PRIMARY',
    name: 'Primary Data Center',
    entityTypeCode: 'INFRASTRUCTURE',
    criticality: 5,
    attributes: { tier: 'Tier 1', location: 'Istanbul', provider: 'Internal' },
  },
  {
    code: 'INFRA-DC-DR',
    name: 'Disaster Recovery Data Center',
    entityTypeCode: 'INFRASTRUCTURE',
    criticality: 5,
    attributes: { tier: 'Tier 1', location: 'Ankara', provider: 'Internal' },
  },
  {
    code: 'INFRA-NETWORK',
    name: 'Corporate Network',
    entityTypeCode: 'INFRASTRUCTURE',
    criticality: 5,
    attributes: { tier: 'Tier 1', type: 'WAN/LAN' },
  },
  // Vendors
  {
    code: 'VENDOR-CLOUD',
    name: 'Cloud Service Provider',
    entityTypeCode: 'VENDOR',
    criticality: 5,
    attributes: { tier: 'Tier 1', service: 'IaaS/PaaS', contract: 'Active' },
  },
  {
    code: 'VENDOR-PAYMENT',
    name: 'Payment Gateway Provider',
    entityTypeCode: 'VENDOR',
    criticality: 5,
    attributes: { tier: 'Tier 1', service: 'Payment Processing', contract: 'Active' },
  },
  {
    code: 'VENDOR-SECURITY',
    name: 'Security Services Provider',
    entityTypeCode: 'VENDOR',
    criticality: 4,
    attributes: { tier: 'Tier 2', service: 'Managed Security', contract: 'Active' },
  },
  // Business Services
  {
    code: 'SRV-CALL-CENTER',
    name: 'Customer Call Center',
    entityTypeCode: 'BUSINESS_SERVICE',
    criticality: 4,
    attributes: { tier: 'Tier 2', hours: '24/7' },
  },
  {
    code: 'SRV-ONLINE-BANKING',
    name: 'Online Banking Service',
    entityTypeCode: 'BUSINESS_SERVICE',
    criticality: 5,
    attributes: { tier: 'Tier 1', availability: '99.9%' },
  },
  {
    code: 'SRV-PAYROLL',
    name: 'Payroll Processing Service',
    entityTypeCode: 'BUSINESS_SERVICE',
    criticality: 4,
    attributes: { tier: 'Tier 2', frequency: 'Monthly' },
  },
];

async function run() {
  const entities_list = [TenantEntity, EntityTypeEntity, EntityEntity, UserEntity];

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
        entities: entities_list,
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
      entities: entities_list,
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

  const getDemoUser = async (ds: DataSource, tenantId: string) => {
    const userRepo = ds.getRepository(UserEntity);
    const user = await userRepo.findOne({
      where: { email: 'grc1@local', tenant_id: tenantId },
    });
    return user;
  };

  const ensureEntityType = async (
    ds: DataSource,
    tenantId: string,
    typeData: typeof entityTypes[0],
  ) => {
    const typeRepo = ds.getRepository(EntityTypeEntity);
    let entityType = await typeRepo.findOne({
      where: { code: typeData.code, tenant_id: tenantId },
    });

    if (entityType) {
      entityType.name = typeData.name;
      entityType.description = typeData.description;
      entityType = await typeRepo.save(entityType);
      console.log(`  ✅ Updated entity type: ${typeData.code}`);
    } else {
      entityType = typeRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        code: typeData.code,
        name: typeData.name,
        description: typeData.description,
      });
      entityType = await typeRepo.save(entityType);
      console.log(`  ✅ Created entity type: ${typeData.code}`);
    }

    return entityType;
  };

  const ensureEntity = async (
    ds: DataSource,
    tenantId: string,
    entityData: typeof entities[0],
    entityTypeId: string,
    userId: string | undefined,
  ) => {
    const entityRepo = ds.getRepository(EntityEntity);
    let entity = await entityRepo.findOne({
      where: { code: entityData.code, tenant_id: tenantId },
    });

    if (entity) {
      entity.name = entityData.name;
      entity.entity_type_id = entityTypeId;
      entity.criticality = entityData.criticality;
      entity.attributes = entityData.attributes;
      entity.owner_user_id = userId;
      entity = await entityRepo.save(entity);
      console.log(`    ✅ Updated entity: ${entityData.code}`);
    } else {
      entity = entityRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        entity_type_id: entityTypeId,
        code: entityData.code,
        name: entityData.name,
        criticality: entityData.criticality,
        attributes: entityData.attributes,
        owner_user_id: userId,
        created_by: userId,
      });
      entity = await entityRepo.save(entity);
      console.log(`    ✅ Created entity: ${entityData.code}`);
    }

    return entity;
  };

  const options = determineDataSourceOptions();
  const dataSource = new DataSource(options);

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');
    console.log('🌱 Starting entity registry seed...\n');

    const tenant = await ensureTenant(dataSource);
    const demoUser = await getDemoUser(dataSource, tenant.id);
    console.log('');

    // Create entity types
    const entityTypeMap = new Map<string, string>();
    for (const typeData of entityTypes) {
      const entityType = await ensureEntityType(dataSource, tenant.id, typeData);
      entityTypeMap.set(typeData.code, entityType.id);
    }
    console.log('');

    // Create entities
    for (const entityData of entities) {
      const entityTypeId = entityTypeMap.get(entityData.entityTypeCode);
      if (entityTypeId) {
        await ensureEntity(dataSource, tenant.id, entityData, entityTypeId, demoUser?.id);
      }
    }

    console.log('\n✅ Entity registry seed completed');
  } catch (error) {
    console.error('❌ Entity registry seed failed', error);
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

