#!/usr/bin/env ts-node
/**
 * Seed Risk Instances
 * 
 * Seeds risk instances linked to risk catalog entries and entities.
 * 
 * Usage: npm run seed:risk-instances
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { RiskInstanceEntity, RiskStatus, EntityType } from '../src/entities/app/risk-instance.entity';
import { RiskCategoryEntity } from '../src/entities/app/risk-category.entity';
import { RiskCatalogEntity } from '../src/entities/app/risk-catalog.entity';
import { EntityTypeEntity } from '../src/entities/app/entity-type.entity';
import { EntityEntity } from '../src/entities/app/entity.entity';
import { TenantEntity } from '../src/entities/tenant/tenant.entity';
import { UserEntity } from '../src/entities/auth/user.entity';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';

// Risk instances - linked to risk catalog and entities
const riskInstances = [
  {
    riskCatalogCode: 'RISK-DATA-BREACH',
    entityCode: 'DB-CUSTOMER',
    entityType: EntityType.DATABASE,
    likelihood: 3,
    impact: 5,
    status: RiskStatus.OPEN,
    notes: 'Customer database contains PII and financial data. Risk of unauthorized access through SQL injection or insider threat.',
  },
  {
    riskCatalogCode: 'RISK-UNAUTHORIZED-ACCESS',
    entityCode: 'APP-CRM',
    entityType: EntityType.APPLICATION,
    likelihood: 4,
    impact: 4,
    status: RiskStatus.OPEN,
    notes: 'CRM system has multiple user roles. Risk of privilege escalation or unauthorized access to customer data.',
  },
  {
    riskCatalogCode: 'RISK-MALWARE',
    entityCode: 'APP-IBANK',
    entityType: EntityType.APPLICATION,
    likelihood: 3,
    impact: 5,
    status: RiskStatus.OPEN,
    notes: 'Internet banking platform is exposed to public internet. Risk of malware infection through user devices or web attacks.',
  },
  {
    riskCatalogCode: 'RISK-SERVICE-OUTAGE',
    entityCode: 'INFRA-DC-PRIMARY',
    entityType: EntityType.FACILITY,
    likelihood: 2,
    impact: 5,
    status: RiskStatus.OPEN,
    notes: 'Primary data center outage could affect all critical systems. Single point of failure risk.',
  },
  {
    riskCatalogCode: 'RISK-VENDOR-FAILURE',
    entityCode: 'VENDOR-CLOUD',
    entityType: EntityType.VENDOR,
    likelihood: 2,
    impact: 4,
    status: RiskStatus.OPEN,
    notes: 'Cloud service provider failure could impact multiple critical applications and services.',
  },
  {
    riskCatalogCode: 'RISK-CAPACITY-SHORTAGE',
    entityCode: 'APP-COREBANK',
    entityType: EntityType.APPLICATION,
    likelihood: 3,
    impact: 4,
    status: RiskStatus.OPEN,
    notes: 'Core banking system experiencing high transaction volumes. Risk of performance degradation during peak hours.',
  },
  {
    riskCatalogCode: 'RISK-CONFIG-ERROR',
    entityCode: 'INFRA-NETWORK',
    entityType: EntityType.NETWORK,
    likelihood: 4,
    impact: 3,
    status: RiskStatus.OPEN,
    notes: 'Network configuration errors could lead to security vulnerabilities or service disruptions.',
  },
  {
    riskCatalogCode: 'RISK-INSIDER-THREAT',
    entityCode: 'APP-ERP',
    entityType: EntityType.APPLICATION,
    likelihood: 2,
    impact: 4,
    status: RiskStatus.OPEN,
    notes: 'ERP system contains sensitive financial and operational data. Risk of insider threat or unauthorized access.',
  },
  {
    riskCatalogCode: 'RISK-BACKUP-FAILURE',
    entityCode: 'DB-TRANSACTION',
    entityType: EntityType.DATABASE,
    likelihood: 2,
    impact: 5,
    status: RiskStatus.OPEN,
    notes: 'Transaction database backup failures could result in data loss. Critical for financial operations.',
  },
  {
    riskCatalogCode: 'RISK-DDOS',
    entityCode: 'APP-IBANK',
    entityType: EntityType.APPLICATION,
    likelihood: 3,
    impact: 4,
    status: RiskStatus.OPEN,
    notes: 'Internet banking platform is vulnerable to DDoS attacks, which could cause service unavailability.',
  },
];

async function run() {
  const entities_list = [
    TenantEntity,
    RiskCategoryEntity,
    RiskCatalogEntity,
    RiskInstanceEntity,
    EntityTypeEntity,
    EntityEntity,
    UserEntity,
  ];

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

  const findRiskCatalog = async (
    ds: DataSource,
    tenantId: string,
    code: string,
  ): Promise<RiskCatalogEntity | null> => {
    const riskRepo = ds.getRepository(RiskCatalogEntity);
    const risk = await riskRepo.findOne({
      where: { code, tenant_id: tenantId },
    });
    return risk;
  };

  const findEntity = async (
    ds: DataSource,
    tenantId: string,
    code: string,
  ): Promise<EntityEntity | null> => {
    const entityRepo = ds.getRepository(EntityEntity);
    const entity = await entityRepo.findOne({
      where: { code, tenant_id: tenantId },
    });
    return entity;
  };

  const ensureRiskInstance = async (
    ds: DataSource,
    tenantId: string,
    instanceData: typeof riskInstances[0],
    catalogId: string,
    entityId: string,
    userId: string | undefined,
  ) => {
    const instanceRepo = ds.getRepository(RiskInstanceEntity);
    
    // Check if instance already exists (unique constraint: catalog_id, entity_id, tenant_id)
    let instance = await instanceRepo.findOne({
      where: {
        catalog_id: catalogId,
        entity_id: entityId,
        tenant_id: tenantId,
      },
    });

    if (instance) {
      instance.likelihood = instanceData.likelihood;
      instance.impact = instanceData.impact;
      instance.status = instanceData.status;
      instance.notes = instanceData.notes;
      instance.owner_id = userId;
      instance.assigned_to = userId;
      instance = await instanceRepo.save(instance);
      console.log(`  ✅ Updated risk instance: ${instanceData.riskCatalogCode} @ ${instanceData.entityCode}`);
    } else {
      instance = instanceRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        catalog_id: catalogId,
        entity_id: entityId,
        entity_type: instanceData.entityType,
        likelihood: instanceData.likelihood,
        impact: instanceData.impact,
        status: instanceData.status,
        notes: instanceData.notes,
        owner_id: userId,
        assigned_to: userId,
        created_by: userId,
      });
      instance = await instanceRepo.save(instance);
      console.log(`  ✅ Created risk instance: ${instanceData.riskCatalogCode} @ ${instanceData.entityCode}`);
    }

    return instance;
  };

  const options = determineDataSourceOptions();
  const dataSource = new DataSource(options);

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');
    console.log('🌱 Starting risk instances seed...\n');

    const tenant = await ensureTenant(dataSource);
    const demoUser = await getDemoUser(dataSource, tenant.id);
    console.log('');

    for (const instanceData of riskInstances) {
      const catalog = await findRiskCatalog(dataSource, tenant.id, instanceData.riskCatalogCode);
      const entity = await findEntity(dataSource, tenant.id, instanceData.entityCode);

      if (!catalog) {
        console.log(`  ⚠️  Risk catalog not found: ${instanceData.riskCatalogCode}`);
        continue;
      }

      if (!entity) {
        console.log(`  ⚠️  Entity not found: ${instanceData.entityCode}`);
        continue;
      }

      await ensureRiskInstance(
        dataSource,
        tenant.id,
        instanceData,
        catalog.id,
        entity.id,
        demoUser?.id,
      );
    }

    console.log('\n✅ Risk instances seed completed');
  } catch (error) {
    console.error('❌ Risk instances seed failed', error);
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

