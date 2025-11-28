#!/usr/bin/env ts-node
/**
 * Seed Risk Catalog
 * 
 * Seeds real-world risk catalog entries
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { RiskCatalogEntity } from '../src/entities/app/risk-catalog.entity';
import { RiskCategoryEntity } from '../src/entities/app/risk-category.entity';
import { TenantEntity } from '../src/entities/tenant/tenant.entity';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';

// Risk categories
const categories = [
  { code: 'INFO_SEC', name: 'Information Security' },
  { code: 'OPERATIONAL', name: 'Operational' },
  { code: 'COMPLIANCE', name: 'Compliance' },
  { code: 'FINANCIAL', name: 'Financial' },
  { code: 'TECHNICAL', name: 'Technical' },
  { code: 'REPUTATIONAL', name: 'Reputational' },
];

// Risk catalog entries
const risks = [
  {
    code: 'RISK-DATA-BREACH',
    name: 'Data Breach',
    description: 'Unauthorized access, disclosure, or theft of sensitive data',
    categoryCode: 'INFO_SEC',
    defaultLikelihood: 3,
    defaultImpact: 5,
  },
  {
    code: 'RISK-UNAUTHORIZED-ACCESS',
    name: 'Unauthorized Access',
    description: 'Unauthorized access to systems, applications, or data',
    categoryCode: 'INFO_SEC',
    defaultLikelihood: 4,
    defaultImpact: 4,
  },
  {
    code: 'RISK-MALWARE',
    name: 'Malware Infection',
    description: 'Malicious software infection leading to data loss or system compromise',
    categoryCode: 'INFO_SEC',
    defaultLikelihood: 3,
    defaultImpact: 4,
  },
  {
    code: 'RISK-PHISHING',
    name: 'Phishing Attack',
    description: 'Social engineering attack to steal credentials or sensitive information',
    categoryCode: 'INFO_SEC',
    defaultLikelihood: 4,
    defaultImpact: 3,
  },
  {
    code: 'RISK-CONFIG-ERROR',
    name: 'Configuration Error',
    description: 'Misconfiguration leading to security vulnerabilities or system failures',
    categoryCode: 'TECHNICAL',
    defaultLikelihood: 4,
    defaultImpact: 3,
  },
  {
    code: 'RISK-BACKUP-FAILURE',
    name: 'Backup Failure',
    description: 'Failure of backup systems leading to data loss',
    categoryCode: 'OPERATIONAL',
    defaultLikelihood: 2,
    defaultImpact: 5,
  },
  {
    code: 'RISK-CAPACITY-SHORTAGE',
    name: 'Capacity Shortage',
    description: 'Insufficient system capacity leading to service degradation or outages',
    categoryCode: 'OPERATIONAL',
    defaultLikelihood: 3,
    defaultImpact: 3,
  },
  {
    code: 'RISK-VENDOR-FAILURE',
    name: 'Vendor Failure',
    description: 'Critical vendor service failure or business disruption',
    categoryCode: 'OPERATIONAL',
    defaultLikelihood: 2,
    defaultImpact: 4,
  },
  {
    code: 'RISK-REG-NONCOMPLIANCE',
    name: 'Regulatory Non-Compliance',
    description: 'Failure to comply with applicable regulations leading to penalties or sanctions',
    categoryCode: 'COMPLIANCE',
    defaultLikelihood: 2,
    defaultImpact: 4,
  },
  {
    code: 'RISK-DATA-LOSS',
    name: 'Data Loss',
    description: 'Accidental or intentional loss of critical data',
    categoryCode: 'INFO_SEC',
    defaultLikelihood: 2,
    defaultImpact: 5,
  },
  {
    code: 'RISK-SERVICE-OUTAGE',
    name: 'Service Outage',
    description: 'Extended service unavailability affecting business operations',
    categoryCode: 'OPERATIONAL',
    defaultLikelihood: 3,
    defaultImpact: 4,
  },
  {
    code: 'RISK-INSIDER-THREAT',
    name: 'Insider Threat',
    description: 'Malicious or negligent actions by internal personnel',
    categoryCode: 'INFO_SEC',
    defaultLikelihood: 2,
    defaultImpact: 4,
  },
  {
    code: 'RISK-DDOS',
    name: 'DDoS Attack',
    description: 'Distributed Denial of Service attack causing service unavailability',
    categoryCode: 'INFO_SEC',
    defaultLikelihood: 3,
    defaultImpact: 4,
  },
  {
    code: 'RISK-SUPPLY-CHAIN',
    name: 'Supply Chain Compromise',
    description: 'Compromise of third-party software or services',
    categoryCode: 'INFO_SEC',
    defaultLikelihood: 2,
    defaultImpact: 4,
  },
  {
    code: 'RISK-FINANCIAL-FRAUD',
    name: 'Financial Fraud',
    description: 'Financial fraud or embezzlement',
    categoryCode: 'FINANCIAL',
    defaultLikelihood: 2,
    defaultImpact: 5,
  },
  {
    code: 'RISK-REPUTATION-DAMAGE',
    name: 'Reputation Damage',
    description: 'Public disclosure of security incidents or compliance failures',
    categoryCode: 'REPUTATIONAL',
    defaultLikelihood: 2,
    defaultImpact: 4,
  },
];

async function run() {
  const { TenantEntity } = await import('../src/entities/tenant/tenant.entity');
  const { RiskCatalogEntity } = await import('../src/entities/app/risk-catalog.entity');
  const { RiskCategoryEntity } = await import('../src/entities/app/risk-category.entity');
  const entities = [TenantEntity, RiskCatalogEntity, RiskCategoryEntity];

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

  const ensureCategory = async (
    ds: DataSource,
    tenantId: string,
    categoryData: typeof categories[0],
  ) => {
    const categoryRepo = ds.getRepository(RiskCategoryEntity);
    let category = await categoryRepo.findOne({
      where: { code: categoryData.code, tenant_id: tenantId },
    });

    if (category) {
      category.name = categoryData.name;
      await categoryRepo.save(category);
      console.log(`✅ Updated category: ${categoryData.code}`);
    } else {
      category = categoryRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        code: categoryData.code,
        name: categoryData.name,
      });
      category = await categoryRepo.save(category);
      console.log(`✅ Created category: ${categoryData.code}`);
    }

    return category;
  };

  const ensureRisk = async (
    ds: DataSource,
    tenantId: string,
    categoryId: string | undefined,
    riskData: typeof risks[0],
  ) => {
    const riskRepo = ds.getRepository(RiskCatalogEntity);
    let risk = await riskRepo.findOne({
      where: { code: riskData.code, tenant_id: tenantId },
    });

    if (risk) {
      risk.name = riskData.name;
      risk.description = riskData.description;
      risk.category_id = categoryId;
      risk.default_likelihood = riskData.defaultLikelihood;
      risk.default_impact = riskData.defaultImpact;
      await riskRepo.save(risk);
      console.log(`  ✅ Updated risk: ${riskData.code}`);
    } else {
      risk = riskRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        code: riskData.code,
        name: riskData.name,
        description: riskData.description,
        category_id: categoryId,
        default_likelihood: riskData.defaultLikelihood,
        default_impact: riskData.defaultImpact,
        schema_version: 1,
      });
      risk = await riskRepo.save(risk);
      console.log(`  ✅ Created risk: ${riskData.code}`);
    }

    return risk;
  };

  const options = determineDataSourceOptions();
  const dataSource = new DataSource(options);

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');
    const tenant = await ensureTenant(dataSource);

    // Create categories
    const categoryMap = new Map<string, string>();
    for (const categoryData of categories) {
      const category = await ensureCategory(dataSource, tenant.id, categoryData);
      categoryMap.set(categoryData.code, category.id);
    }

    // Create risks
    for (const riskData of risks) {
      const categoryId = categoryMap.get(riskData.categoryCode);
      await ensureRisk(dataSource, tenant.id, categoryId, riskData);
    }

    console.log('✅ Risk catalog seed completed');
  } catch (error) {
    console.error('❌ Risk catalog seed failed', error);
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

run();

