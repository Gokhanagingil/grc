#!/usr/bin/env ts-node
/**
 * Smoke Test for Demo Data
 * 
 * Verifies that demo data has been seeded correctly.
 * 
 * Usage: npm run smoke:demo-data
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { TenantEntity } from '../src/entities/tenant/tenant.entity';
import { UserEntity } from '../src/entities/auth/user.entity';
import { StandardEntity } from '../src/entities/app/standard.entity';
import { StandardClauseEntity } from '../src/entities/app/standard-clause.entity';
import { ControlLibraryEntity } from '../src/entities/app/control-library.entity';
import { PolicyEntity } from '../src/entities/app/policy.entity';
import { RiskCategoryEntity } from '../src/entities/app/risk-category.entity';
import { RiskCatalogEntity } from '../src/entities/app/risk-catalog.entity';
import { RiskInstanceEntity } from '../src/entities/app/risk-instance.entity';
import { RiskInstanceAttachmentEntity } from '../src/entities/app/risk-instance-attachment.entity';
import { RiskCatalogAttachmentEntity } from '../src/entities/app/risk-catalog-attachment.entity';
import { RiskToControlEntity } from '../src/entities/app/risk-to-control.entity';
import { RiskToPolicyEntity } from '../src/entities/app/risk-to-policy.entity';
import { RiskToRequirementEntity } from '../src/entities/app/risk-to-requirement.entity';
import { RequirementEntity } from '../src/modules/compliance/comp.entity';
import { RegulationEntity } from '../src/entities/app/regulation.entity';
import { StandardClauseEntity as StandardClauseEntity2 } from '../src/entities/app/standard-clause.entity';
import { AuditPlanEntity } from '../src/entities/app/audit-plan.entity';
import { AuditEngagementEntity } from '../src/entities/app/audit-engagement.entity';
import { AuditTestEntity } from '../src/entities/app/audit-test.entity';
import { AuditEvidenceEntity } from '../src/entities/app/audit-evidence.entity';
import { AuditFindingEntity } from '../src/entities/app/audit-finding.entity';
import { CorrectiveActionEntity } from '../src/entities/app/corrective-action.entity';
import { BIAProcessEntity } from '../src/entities/app/bia-process.entity';
import { BIAProcessDependencyEntity } from '../src/entities/app/bia-process-dependency.entity';
import { BCPPlanEntity } from '../src/entities/app/bcp-plan.entity';
import { BCPExerciseEntity } from '../src/entities/app/bcp-exercise.entity';
import { EntityTypeEntity } from '../src/entities/app/entity-type.entity';
import { EntityEntity } from '../src/entities/app/entity.entity';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';

interface SmokeTestResult {
  name: string;
  passed: boolean;
  count: number;
  expected: number;
  message?: string;
}

async function run() {
  const entities = [
    TenantEntity,
    UserEntity,
    StandardEntity,
    StandardClauseEntity,
    ControlLibraryEntity,
    PolicyEntity,
    RiskCategoryEntity,
    RiskCatalogEntity,
    RiskCatalogAttachmentEntity,
    RiskToControlEntity,
    RiskToPolicyEntity,
    RiskToRequirementEntity,
    RequirementEntity,
    RegulationEntity,
    RiskInstanceEntity,
    RiskInstanceAttachmentEntity,
    AuditPlanEntity,
    AuditEngagementEntity,
    AuditTestEntity,
    AuditEvidenceEntity,
    AuditFindingEntity,
    CorrectiveActionEntity,
    BIAProcessEntity,
    BIAProcessDependencyEntity,
    BCPPlanEntity,
    BCPExerciseEntity,
    EntityTypeEntity,
    EntityEntity,
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
    console.log('🔍 Running smoke tests for demo data...\n');

    // Test 1: Demo users exist
    const userRepo = dataSource.getRepository(UserEntity);
    const userCount = await userRepo.count({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });
    results.push({
      name: 'Demo Users',
      passed: userCount >= 2,
      count: userCount,
      expected: 2,
      message: userCount >= 2 ? '✅ Demo users exist' : '❌ Demo users missing',
    });

    // Test 2: Standards exist
    const standardRepo = dataSource.getRepository(StandardEntity);
    const standardCount = await standardRepo.count({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });
    results.push({
      name: 'Standards',
      passed: standardCount >= 3,
      count: standardCount,
      expected: 3,
      message: standardCount >= 3 ? '✅ Standards exist' : '❌ Standards missing',
    });

    // Test 2.5: Standard Clauses exist
    const clauseRepo = dataSource.getRepository(StandardClauseEntity);
    const clauseCount = await clauseRepo.count({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });
    results.push({
      name: 'Standard Clauses',
      passed: clauseCount >= 10,
      count: clauseCount,
      expected: 10,
      message: clauseCount >= 10 ? '✅ Standard clauses exist' : '❌ Standard clauses missing',
    });

    // Test 3: Controls exist
    const controlRepo = dataSource.getRepository(ControlLibraryEntity);
    const controlCount = await controlRepo.count({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });
    results.push({
      name: 'Controls',
      passed: controlCount >= 30,
      count: controlCount,
      expected: 30,
      message: controlCount >= 30 ? '✅ Controls exist' : '❌ Controls missing',
    });

    // Test 4: Policies exist
    const policyRepo = dataSource.getRepository(PolicyEntity);
    const policyCount = await policyRepo.count({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });
    results.push({
      name: 'Policies',
      passed: policyCount >= 8,
      count: policyCount,
      expected: 8,
      message: policyCount >= 8 ? '✅ Policies exist' : '❌ Policies missing',
    });

    // Test 5: Risk Catalog entries
    const riskCatalogRepo = dataSource.getRepository(RiskCatalogEntity);
    const riskCatalogCount = await riskCatalogRepo.count({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });
    results.push({
      name: 'Risk Catalog',
      passed: riskCatalogCount >= 10,
      count: riskCatalogCount,
      expected: 10,
      message: riskCatalogCount >= 10 ? '✅ Risk catalog entries exist' : '❌ Risk catalog entries missing',
    });

    // Test 6: Risk Instances
    const riskInstanceRepo = dataSource.getRepository(RiskInstanceEntity);
    const riskInstanceCount = await riskInstanceRepo.count({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });
    results.push({
      name: 'Risk Instances',
      passed: riskInstanceCount >= 5,
      count: riskInstanceCount,
      expected: 5,
      message: riskInstanceCount >= 5 ? '✅ Risk instances exist' : '❌ Risk instances missing',
    });

    // Test 7: Audit Plans
    const auditPlanRepo = dataSource.getRepository(AuditPlanEntity);
    const auditPlanCount = await auditPlanRepo.count({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });
    results.push({
      name: 'Audit Plans',
      passed: auditPlanCount >= 1,
      count: auditPlanCount,
      expected: 1,
      message: auditPlanCount >= 1 ? '✅ Audit plans exist' : '❌ Audit plans missing',
    });

    // Test 8: Audit Engagements
    const auditEngagementRepo = dataSource.getRepository(AuditEngagementEntity);
    const auditEngagementCount = await auditEngagementRepo.count({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });
    results.push({
      name: 'Audit Engagements',
      passed: auditEngagementCount >= 1,
      count: auditEngagementCount,
      expected: 1,
      message: auditEngagementCount >= 1 ? '✅ Audit engagements exist' : '❌ Audit engagements missing',
    });

    // Test 9: Audit Findings
    const auditFindingRepo = dataSource.getRepository(AuditFindingEntity);
    const auditFindingCount = await auditFindingRepo.count({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });
    results.push({
      name: 'Audit Findings',
      passed: auditFindingCount >= 1,
      count: auditFindingCount,
      expected: 1,
      message: auditFindingCount >= 1 ? '✅ Audit findings exist' : '❌ Audit findings missing',
    });

    // Test 10: Corrective Actions (CAPs)
    const capRepo = dataSource.getRepository(CorrectiveActionEntity);
    const capCount = await capRepo.count({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });
    results.push({
      name: 'Corrective Actions (CAPs)',
      passed: capCount >= 1,
      count: capCount,
      expected: 1,
      message: capCount >= 1 ? '✅ CAPs exist' : '❌ CAPs missing',
    });

    // Test 11: BIA Processes
    const biaProcessRepo = dataSource.getRepository(BIAProcessEntity);
    const biaProcessCount = await biaProcessRepo.count({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });
    results.push({
      name: 'BIA Processes',
      passed: biaProcessCount >= 1,
      count: biaProcessCount,
      expected: 1,
      message: biaProcessCount >= 1 ? '✅ BIA processes exist' : '❌ BIA processes missing',
    });

    // Test 12: BCP Plans
    const bcpPlanRepo = dataSource.getRepository(BCPPlanEntity);
    const bcpPlanCount = await bcpPlanRepo.count({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });
    results.push({
      name: 'BCP Plans',
      passed: bcpPlanCount >= 1,
      count: bcpPlanCount,
      expected: 1,
      message: bcpPlanCount >= 1 ? '✅ BCP plans exist' : '❌ BCP plans missing',
    });

    // Test 13: Entities (entity registry)
    const entityRepo = dataSource.getRepository(EntityEntity);
    const entityCount = await entityRepo.count({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });
    results.push({
      name: 'Entities',
      passed: entityCount >= 10,
      count: entityCount,
      expected: 10,
      message: entityCount >= 10 ? '✅ Entities exist' : '❌ Entities missing',
    });

    // Print results
    console.log('📊 Smoke Test Results:\n');
    let allPassed = true;
    for (const result of results) {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.name}: ${result.count}/${result.expected} ${result.message || ''}`);
      if (!result.passed) {
        allPassed = false;
      }
    }

    console.log('\n' + '='.repeat(50));
    if (allPassed) {
      console.log('✅ All smoke tests PASSED');
      process.exitCode = 0;
    } else {
      console.log('❌ Some smoke tests FAILED');
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('❌ Smoke test failed', error);
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

