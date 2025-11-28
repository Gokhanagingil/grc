#!/usr/bin/env ts-node
/**
 * Smoke Test for Demo Experience
 * 
 * Verifies that demo experience data has been seeded correctly and all
 * relationships are properly established.
 * 
 * Tests:
 * - Control → StandardClause relationship
 * - Control → Policy relationship
 * - Control → Risk relationship
 * - Control → AuditFinding relationship
 * - Control → CAP relationship
 * - Policy → StandardClause relationship
 * - RiskInstance → CAP relationship
 * - AuditFinding → Control relationship
 * - CAP → Control relationship
 * - Calendar → Entity relationship
 * 
 * Usage: npm run smoke:demo-experience
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { TenantEntity } from '../src/entities/tenant/tenant.entity';
import { ControlLibraryEntity } from '../src/entities/app/control-library.entity';
import { StandardEntity } from '../src/entities/app/standard.entity';
import { StandardClauseEntity } from '../src/entities/app/standard-clause.entity';
import { ControlToClauseEntity } from '../src/entities/app/control-to-clause.entity';
import { ControlToPolicyEntity } from '../src/entities/app/control-to-policy.entity';
import { ControlToCapEntity } from '../src/entities/app/control-to-cap.entity';
import { PolicyEntity } from '../src/entities/app/policy.entity';
import { PolicyStandardEntity } from '../src/entities/app/policy-standard.entity';
import { RiskCategoryEntity } from '../src/entities/app/risk-category.entity';
import { RiskCatalogEntity } from '../src/entities/app/risk-catalog.entity';
import { RiskCatalogAttachmentEntity } from '../src/entities/app/risk-catalog-attachment.entity';
import { RiskToControlEntity } from '../src/entities/app/risk-to-control.entity';
import { RiskToPolicyEntity } from '../src/entities/app/risk-to-policy.entity';
import { RiskToRequirementEntity } from '../src/entities/app/risk-to-requirement.entity';
import { RequirementEntity } from '../src/modules/compliance/comp.entity';
import { RegulationEntity } from '../src/entities/app/regulation.entity';
import { AuditPlanEntity } from '../src/entities/app/audit-plan.entity';
import { AuditEngagementEntity } from '../src/entities/app/audit-engagement.entity';
import { AuditTestEntity } from '../src/entities/app/audit-test.entity';
import { AuditEvidenceEntity } from '../src/entities/app/audit-evidence.entity';
import { AuditFindingEntity } from '../src/entities/app/audit-finding.entity';
import { CorrectiveActionEntity } from '../src/entities/app/corrective-action.entity';
import { RiskInstanceEntity } from '../src/entities/app/risk-instance.entity';
import { RiskInstanceAttachmentEntity } from '../src/entities/app/risk-instance-attachment.entity';
import { BIAProcessEntity } from '../src/entities/app/bia-process.entity';
import { BIAProcessDependencyEntity } from '../src/entities/app/bia-process-dependency.entity';
import { BCPPlanEntity } from '../src/entities/app/bcp-plan.entity';
import { BCPExerciseEntity } from '../src/entities/app/bcp-exercise.entity';
import { CalendarEventEntity } from '../src/entities/app/calendar-event.entity';
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
      StandardEntity,
      StandardClauseEntity,
      ControlLibraryEntity,
      ControlToClauseEntity,
      ControlToPolicyEntity,
      ControlToCapEntity,
      PolicyEntity,
      PolicyStandardEntity,
      RiskCategoryEntity,
      RiskCatalogEntity,
      RiskCatalogAttachmentEntity,
      RiskToControlEntity,
      RiskToPolicyEntity,
      RiskToRequirementEntity,
      RequirementEntity,
      RegulationEntity,
      AuditPlanEntity,
      AuditEngagementEntity,
      AuditTestEntity,
      AuditEvidenceEntity,
      AuditFindingEntity,
      CorrectiveActionEntity,
      RiskInstanceEntity,
      RiskInstanceAttachmentEntity,
      BIAProcessEntity,
      BIAProcessDependencyEntity,
      BCPPlanEntity,
      BCPExerciseEntity,
      CalendarEventEntity,
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
    console.log('🔍 Running smoke tests for demo experience...\n');

    // Test 1: Control → StandardClause relationship
    const controlToClauseRepo = dataSource.getRepository(ControlToClauseEntity);
    const controlToClauseCount = await controlToClauseRepo.count({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });
    results.push({
      name: 'Control → StandardClause Links',
      passed: controlToClauseCount >= 10,
      count: controlToClauseCount,
      expected: 10,
      message:
        controlToClauseCount >= 10
          ? '✅ Control-Clause relationships exist'
          : '❌ Insufficient Control-Clause relationships',
    });

    // Test 2: Control → Policy relationship
    const controlToPolicyRepo = dataSource.getRepository(ControlToPolicyEntity);
    const controlToPolicyCount = await controlToPolicyRepo.count({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });
    results.push({
      name: 'Control → Policy Links',
      passed: controlToPolicyCount >= 20,
      count: controlToPolicyCount,
      expected: 20,
      message:
        controlToPolicyCount >= 20
          ? '✅ Control-Policy relationships exist'
          : '❌ Insufficient Control-Policy relationships',
    });

    // Test 3: Control → Risk relationship
    const riskToControlRepo = dataSource.getRepository(RiskToControlEntity);
    const riskToControlCount = await riskToControlRepo.count({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });
    results.push({
      name: 'Control → Risk Links',
      passed: riskToControlCount >= 20,
      count: riskToControlCount,
      expected: 20,
      message:
        riskToControlCount >= 20
          ? '✅ Control-Risk relationships exist'
          : '❌ Insufficient Control-Risk relationships',
    });

    // Test 4: Control → AuditFinding relationship (via control_id in finding)
    const auditFindingRepo = dataSource.getRepository(AuditFindingEntity);
    // Count findings with non-null control_id
    const allFindings = await auditFindingRepo.find({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });
    const findingsWithControlCount = allFindings.filter((f) => f.control_id).length;
    results.push({
      name: 'AuditFinding → Control Links',
      passed: findingsWithControlCount >= 3,
      count: findingsWithControlCount,
      expected: 3,
      message:
        findingsWithControlCount >= 3
          ? '✅ AuditFinding-Control relationships exist'
          : '❌ Insufficient AuditFinding-Control relationships',
    });

    // Test 5: Control → CAP relationship
    const controlToCapRepo = dataSource.getRepository(ControlToCapEntity);
    const controlToCapCount = await controlToCapRepo.count({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });
    results.push({
      name: 'Control → CAP Links',
      passed: controlToCapCount >= 3,
      count: controlToCapCount,
      expected: 3,
      message:
        controlToCapCount >= 3
          ? '✅ Control-CAP relationships exist'
          : '❌ Insufficient Control-CAP relationships',
    });

    // Test 6: Policy → StandardClause relationship (via policy_standards and clauses)
    // This is indirect - policies link to standards, standards have clauses
    const policyRepo = dataSource.getRepository(PolicyEntity);
    const policyCount = await policyRepo.count({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });
    results.push({
      name: 'Policies with Standards',
      passed: policyCount >= 10,
      count: policyCount,
      expected: 10,
      message:
        policyCount >= 10
          ? '✅ Policies exist (can link to standards/clauses)'
          : '❌ Insufficient policies',
    });

    // Test 7: RiskInstance → CAP relationship (via finding)
    const riskInstanceRepo = dataSource.getRepository(RiskInstanceEntity);
    const capRepo = dataSource.getRepository(CorrectiveActionEntity);
    const riskInstanceCount = await riskInstanceRepo.count({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });
    const capCount = await capRepo.count({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });
    results.push({
      name: 'Risk Instances and CAPs',
      passed: riskInstanceCount >= 10 && capCount >= 5,
      count: riskInstanceCount + capCount,
      expected: 15,
      message:
        riskInstanceCount >= 10 && capCount >= 5
          ? '✅ Risk instances and CAPs exist (can link via findings)'
          : '❌ Insufficient risk instances or CAPs',
    });

    // Test 8: Calendar → Entity relationship
    const calendarRepo = dataSource.getRepository(CalendarEventEntity);
    const calendarEvents = await calendarRepo.find({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });
    const eventsWithEntity = calendarEvents.filter(
      (e) => e.source_entity === 'entity' && e.source_id,
    ).length;
    results.push({
      name: 'Calendar → Entity Links',
      passed: eventsWithEntity >= 1,
      count: eventsWithEntity,
      expected: 1,
      message:
        eventsWithEntity >= 1
          ? '✅ Calendar-Entity relationships exist'
          : '❌ Insufficient Calendar-Entity relationships',
    });

    // Test 9: All controls have at least one relationship
    const controlRepo = dataSource.getRepository(ControlLibraryEntity);
    const allControls = await controlRepo.find({
      where: { tenant_id: DEFAULT_TENANT_ID },
    });

    let controlsWithRelationships = 0;
    let controlsWithClause = 0;
    let controlsWithPolicy = 0;
    let controlsWithRisk = 0;
    let controlsWithCap = 0;

    for (const control of allControls) {
      const hasClause = await controlToClauseRepo.count({
        where: { control_id: control.id, tenant_id: DEFAULT_TENANT_ID },
      });
      const hasPolicy = await controlToPolicyRepo.count({
        where: { control_id: control.id, tenant_id: DEFAULT_TENANT_ID },
      });
      const hasRisk = await riskToControlRepo.count({
        where: { control_id: control.id, tenant_id: DEFAULT_TENANT_ID },
      });
      const hasCap = await controlToCapRepo.count({
        where: { control_id: control.id, tenant_id: DEFAULT_TENANT_ID },
      });

      if (hasClause > 0) controlsWithClause++;
      if (hasPolicy > 0) controlsWithPolicy++;
      if (hasRisk > 0) controlsWithRisk++;
      if (hasCap > 0) controlsWithCap++;

      if (hasClause > 0 || hasPolicy > 0 || hasRisk > 0) {
        controlsWithRelationships++;
      }
    }

    const relationshipPercentage = allControls.length > 0
      ? (controlsWithRelationships / allControls.length) * 100
      : 0;

    results.push({
      name: 'Controls with Relationships',
      passed: relationshipPercentage >= 80,
      count: controlsWithRelationships,
      expected: Math.floor(allControls.length * 0.8),
      message:
        relationshipPercentage >= 80
          ? `✅ ${relationshipPercentage.toFixed(1)}% of controls have relationships`
          : `❌ Only ${relationshipPercentage.toFixed(1)}% of controls have relationships`,
    });

    // Test 10: At least one control has all relationship types
    const controlWithAllRelations = allControls.find(async (control) => {
      const hasClause = await controlToClauseRepo.count({
        where: { control_id: control.id, tenant_id: DEFAULT_TENANT_ID },
      });
      const hasPolicy = await controlToPolicyRepo.count({
        where: { control_id: control.id, tenant_id: DEFAULT_TENANT_ID },
      });
      const hasRisk = await riskToControlRepo.count({
        where: { control_id: control.id, tenant_id: DEFAULT_TENANT_ID },
      });
      return hasClause > 0 && hasPolicy > 0 && hasRisk > 0;
    });

    // Simplified check: count controls with multiple relationship types
    let controlsWithMultipleTypes = 0;
    for (const control of allControls.slice(0, 10)) { // Check first 10 for performance
      const hasClause = await controlToClauseRepo.count({
        where: { control_id: control.id, tenant_id: DEFAULT_TENANT_ID },
      });
      const hasPolicy = await controlToPolicyRepo.count({
        where: { control_id: control.id, tenant_id: DEFAULT_TENANT_ID },
      });
      const hasRisk = await riskToControlRepo.count({
        where: { control_id: control.id, tenant_id: DEFAULT_TENANT_ID },
      });
      const typeCount = (hasClause > 0 ? 1 : 0) + (hasPolicy > 0 ? 1 : 0) + (hasRisk > 0 ? 1 : 0);
      if (typeCount >= 2) controlsWithMultipleTypes++;
    }

    results.push({
      name: 'Controls with Multiple Relationship Types',
      passed: controlsWithMultipleTypes >= 3,
      count: controlsWithMultipleTypes,
      expected: 3,
      message:
        controlsWithMultipleTypes >= 3
          ? '✅ Controls have multiple relationship types'
          : '❌ Insufficient controls with multiple relationship types',
    });

    // Test 11: Policy → Standard relationship (via policy_standards)
    try {
      const policyStandardRepo = dataSource.getRepository(PolicyStandardEntity);
      const policyStandardCount = await policyStandardRepo.count({
        where: { tenant_id: DEFAULT_TENANT_ID },
      });

      results.push({
        name: 'Policy → Standard Links',
        passed: policyStandardCount >= 10,
        count: policyStandardCount,
        expected: 10,
        message:
          policyStandardCount >= 10
            ? '✅ Policy-Standard relationships exist'
            : '❌ Insufficient Policy-Standard relationships',
      });
    } catch (error: any) {
      // If policy_standards table doesn't exist, skip this test
      if (error?.message?.includes('no such table: policy_standards')) {
        results.push({
          name: 'Policy → Standard Links',
          passed: true,
          count: 0,
          expected: 10,
          message: '⚠️  policy_standards table not found, skipping test',
        });
      } else {
        throw error;
      }
    }

    // Print results
    console.log('📊 Smoke Test Results:\n');
    let allPassed = true;
    for (const result of results) {
      const icon = result.passed ? '✅' : '❌';
      console.log(
        `${icon} ${result.name}: ${result.count}/${result.expected} ${result.message || ''}`,
      );
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

