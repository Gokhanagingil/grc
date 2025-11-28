#!/usr/bin/env ts-node
/**
 * Seed BCM Demo Data
 * 
 * Seeds Business Continuity Management data:
 * - BIA Processes
 * - BCP Plans
 * - BCP Exercises
 * - BIA Process Dependencies
 * 
 * Usage: npm run seed:bcm-demo
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { BIAProcessEntity } from '../src/entities/app/bia-process.entity';
import { BCPPlanEntity, BCPPlanStatus } from '../src/entities/app/bcp-plan.entity';
import { BCPExerciseEntity } from '../src/entities/app/bcp-exercise.entity';
import { BIAProcessDependencyEntity, DependencyType } from '../src/entities/app/bia-process-dependency.entity';
import { EntityTypeEntity } from '../src/entities/app/entity-type.entity';
import { EntityEntity } from '../src/entities/app/entity.entity';
import { TenantEntity } from '../src/entities/tenant/tenant.entity';
import { UserEntity } from '../src/entities/auth/user.entity';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';

// BIA Processes
const biaProcesses = [
  {
    code: 'BIA-CALL-CENTER',
    name: 'Customer Call Center',
    description: '24/7 customer support and service operations',
    criticality: 5,
    rtoHours: 2,
    rpoHours: 1,
    mtpdHours: 4,
    dependencies: [
      { entityCode: 'APP-CRM', dependencyType: DependencyType.APPLICATION },
      { entityCode: 'INFRA-NETWORK', dependencyType: DependencyType.SERVICE },
      { entityCode: 'VENDOR-CLOUD', dependencyType: DependencyType.VENDOR },
    ],
  },
  {
    code: 'BIA-ONLINE-BANKING',
    name: 'Internet Banking',
    description: 'Online banking platform for customer transactions',
    criticality: 5,
    rtoHours: 1,
    rpoHours: 0.5,
    mtpdHours: 2,
    dependencies: [
      { entityCode: 'APP-IBANK', dependencyType: DependencyType.APPLICATION },
      { entityCode: 'DB-CUSTOMER', dependencyType: DependencyType.DATABASE },
      { entityCode: 'INFRA-DC-PRIMARY', dependencyType: DependencyType.SERVICE },
      { entityCode: 'VENDOR-PAYMENT', dependencyType: DependencyType.VENDOR },
    ],
  },
  {
    code: 'BIA-CORE-BANKING',
    name: 'Core Banking Operations',
    description: 'Core banking system for account management and transactions',
    criticality: 5,
    rtoHours: 4,
    rpoHours: 1,
    mtpdHours: 8,
    dependencies: [
      { entityCode: 'APP-COREBANK', dependencyType: DependencyType.APPLICATION },
      { entityCode: 'DB-TRANSACTION', dependencyType: DependencyType.DATABASE },
      { entityCode: 'INFRA-DC-PRIMARY', dependencyType: DependencyType.SERVICE },
    ],
  },
  {
    code: 'BIA-ERP-FINANCE',
    name: 'ERP Financial Processes',
    description: 'Financial management and accounting processes',
    criticality: 4,
    rtoHours: 8,
    rpoHours: 4,
    mtpdHours: 24,
    dependencies: [
      { entityCode: 'APP-ERP', dependencyType: DependencyType.APPLICATION },
      { entityCode: 'DB-ANALYTICS', dependencyType: DependencyType.DATABASE },
    ],
  },
  {
    code: 'BIA-DC-OPERATIONS',
    name: 'Data Center Operations',
    description: 'Data center infrastructure and operations',
    criticality: 5,
    rtoHours: 2,
    rpoHours: 1,
    mtpdHours: 4,
    dependencies: [
      { entityCode: 'INFRA-DC-PRIMARY', dependencyType: DependencyType.SERVICE },
      { entityCode: 'INFRA-DC-DR', dependencyType: DependencyType.SERVICE },
    ],
  },
  {
    code: 'BIA-PAYROLL',
    name: 'Payroll Processing',
    description: 'Monthly payroll processing and employee payments',
    criticality: 4,
    rtoHours: 24,
    rpoHours: 8,
    mtpdHours: 72,
    dependencies: [
      { entityCode: 'APP-HRMS', dependencyType: DependencyType.APPLICATION },
      { entityCode: 'SRV-PAYROLL', dependencyType: DependencyType.SERVICE },
    ],
  },
];

// BCP Plans
const bcpPlans = [
  {
    code: 'BCP-DC-DR',
    name: 'Data Center Disaster Recovery Plan',
    version: '2.0',
    status: BCPPlanStatus.APPROVED,
    processCode: 'BIA-DC-OPERATIONS',
    steps: [
      { step: 1, title: 'Activate DR Site', description: 'Activate disaster recovery data center' },
      { step: 2, title: 'Restore Systems', description: 'Restore critical systems from backups' },
      { step: 3, title: 'Verify Operations', description: 'Verify all systems are operational' },
      { step: 4, title: 'Communicate Status', description: 'Communicate recovery status to stakeholders' },
    ],
    exercises: [
      {
        code: 'EX-DC-DR-2025-Q1',
        name: 'Q1 2025 DR Exercise',
        date: '2025-03-15',
        scenario: 'Simulated primary data center outage',
        result: 'Exercise completed successfully. RTO met. Minor issues identified in backup restoration process.',
        findingsCount: 2,
        capsCount: 1,
      },
    ],
  },
  {
    code: 'BCP-PANDEMIC',
    name: 'Pandemic Business Continuity Plan',
    version: '1.5',
    status: BCPPlanStatus.APPROVED,
    processCode: null,
    steps: [
      { step: 1, title: 'Activate Remote Work', description: 'Enable remote work capabilities for all staff' },
      { step: 2, title: 'Secure Access', description: 'Ensure secure remote access to systems' },
      { step: 3, title: 'Monitor Operations', description: 'Monitor business operations and service levels' },
    ],
    exercises: [
      {
        code: 'EX-PANDEMIC-2024',
        name: '2024 Pandemic Response Exercise',
        date: '2024-11-20',
        scenario: 'Table-top exercise for pandemic response',
        result: 'Exercise completed. Remote work capabilities verified. Communication plan needs update.',
        findingsCount: 1,
        capsCount: 1,
      },
    ],
  },
  {
    code: 'BCP-ONLINE-BANKING',
    name: 'Online Banking Service Continuity Plan',
    version: '1.0',
    status: BCPPlanStatus.APPROVED,
    processCode: 'BIA-ONLINE-BANKING',
    steps: [
      { step: 1, title: 'Failover to DR', description: 'Failover online banking to DR environment' },
      { step: 2, title: 'Verify Services', description: 'Verify all banking services are operational' },
      { step: 3, title: 'Customer Communication', description: 'Communicate service status to customers' },
    ],
    exercises: [
      {
        code: 'EX-IBANK-DR-2024',
        name: '2024 Internet Banking DR Test',
        date: '2024-12-10',
        scenario: 'Full DR test for internet banking platform',
        result: 'DR test passed. RTO and RPO met. Load balancing configuration needs improvement.',
        findingsCount: 1,
        capsCount: 1,
      },
    ],
  },
];

async function run() {
  const entities_list = [
    TenantEntity,
    BIAProcessEntity,
    BCPPlanEntity,
    BCPExerciseEntity,
    BIAProcessDependencyEntity,
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

  const ensureBIAProcess = async (
    ds: DataSource,
    tenantId: string,
    processData: typeof biaProcesses[0],
    userId: string | undefined,
  ) => {
    const processRepo = ds.getRepository(BIAProcessEntity);
    let process = await processRepo.findOne({
      where: { code: processData.code, tenant_id: tenantId },
    });

    if (process) {
      process.name = processData.name;
      process.description = processData.description;
      process.criticality = processData.criticality;
      process.rto_hours = processData.rtoHours;
      process.rpo_hours = processData.rpoHours;
      process.mtpd_hours = processData.mtpdHours;
      process.owner_user_id = userId;
      process = await processRepo.save(process);
      console.log(`  ✅ Updated BIA process: ${processData.code}`);
    } else {
      process = processRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        code: processData.code,
        name: processData.name,
        description: processData.description,
        criticality: processData.criticality,
        rto_hours: processData.rtoHours,
        rpo_hours: processData.rpoHours,
        mtpd_hours: processData.mtpdHours,
        owner_user_id: userId,
        created_by: userId,
      });
      process = await processRepo.save(process);
      console.log(`  ✅ Created BIA process: ${processData.code}`);
    }

    // Create dependencies
    const depRepo = ds.getRepository(BIAProcessDependencyEntity);
    for (const depData of processData.dependencies) {
      const entity = await findEntity(ds, tenantId, depData.entityCode);
      if (!entity) {
        console.log(`    ⚠️  Entity not found for dependency: ${depData.entityCode}`);
        continue;
      }

      let dep = await depRepo.findOne({
        where: {
          process_id: process.id,
          entity_id: entity.id,
          tenant_id: tenantId,
        },
      });

      if (!dep) {
        dep = depRepo.create({
          id: randomUUID(),
          tenant_id: tenantId,
          process_id: process.id,
          entity_id: entity.id,
          dependency_type: depData.dependencyType,
          created_by: userId,
        });
        dep = await depRepo.save(dep);
        console.log(`    ✅ Created dependency: ${depData.entityCode}`);
      }
    }

    return process;
  };

  const ensureBCPPlan = async (
    ds: DataSource,
    tenantId: string,
    planData: typeof bcpPlans[0],
    processId: string | undefined,
    userId: string | undefined,
  ) => {
    const planRepo = ds.getRepository(BCPPlanEntity);
    let plan = await planRepo.findOne({
      where: { code: planData.code, tenant_id: tenantId },
    });

    if (plan) {
      plan.name = planData.name;
      plan.version = planData.version;
      plan.status = planData.status;
      plan.process_id = processId;
      plan.steps = planData.steps;
      plan = await planRepo.save(plan);
      console.log(`  ✅ Updated BCP plan: ${planData.code}`);
    } else {
      plan = planRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        code: planData.code,
        name: planData.name,
        version: planData.version,
        status: planData.status,
        process_id: processId,
        steps: planData.steps,
        created_by: userId,
      });
      plan = await planRepo.save(plan);
      console.log(`  ✅ Created BCP plan: ${planData.code}`);
    }

    // Create exercises
    const exerciseRepo = ds.getRepository(BCPExerciseEntity);
    for (const exerciseData of planData.exercises) {
      let exercise = await exerciseRepo.findOne({
        where: { code: exerciseData.code, tenant_id: tenantId },
      });

      if (exercise) {
        exercise.name = exerciseData.name;
        exercise.date = new Date(exerciseData.date);
        exercise.scenario = exerciseData.scenario;
        exercise.result = exerciseData.result;
        exercise.findings_count = exerciseData.findingsCount;
        exercise.caps_count = exerciseData.capsCount;
        exercise = await exerciseRepo.save(exercise);
        console.log(`    ✅ Updated exercise: ${exerciseData.code}`);
      } else {
        exercise = exerciseRepo.create({
          id: randomUUID(),
          tenant_id: tenantId,
          plan_id: plan.id,
          code: exerciseData.code,
          name: exerciseData.name,
          date: new Date(exerciseData.date),
          scenario: exerciseData.scenario,
          result: exerciseData.result,
          findings_count: exerciseData.findingsCount,
          caps_count: exerciseData.capsCount,
          created_by: userId,
        });
        exercise = await exerciseRepo.save(exercise);
        console.log(`    ✅ Created exercise: ${exerciseData.code}`);
      }
    }

    return plan;
  };

  const options = determineDataSourceOptions();
  const dataSource = new DataSource(options);

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');
    console.log('🌱 Starting BCM demo seed...\n');

    const tenant = await ensureTenant(dataSource);
    const demoUser = await getDemoUser(dataSource, tenant.id);
    console.log('');

    // Create BIA processes
    const processMap = new Map<string, string>();
    for (const processData of biaProcesses) {
      const process = await ensureBIAProcess(dataSource, tenant.id, processData, demoUser?.id);
      processMap.set(processData.code, process.id);
    }
    console.log('');

    // Create BCP plans
    for (const planData of bcpPlans) {
      const processId = planData.processCode ? processMap.get(planData.processCode) : undefined;
      await ensureBCPPlan(dataSource, tenant.id, planData, processId, demoUser?.id);
    }

    console.log('\n✅ BCM demo seed completed');
  } catch (error) {
    console.error('❌ BCM demo seed failed', error);
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

