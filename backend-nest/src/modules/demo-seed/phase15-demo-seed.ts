#!/usr/bin/env ts-node

/**
 * Phase 15 Demo Seed Script
 * Seeds BCM (BIA Processes, Dependencies, BCP Plans, Exercises) and links to Audit findings
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { randomUUID } from 'crypto';
import {
  BIAProcessEntity,
  BIAProcessDependencyEntity,
  BCPPlanEntity,
  BCPExerciseEntity,
  EntityEntity,
  AuditFindingEntity,
  CorrectiveActionEntity,
  RiskInstanceEntity,
} from '../../entities/app';
import { BIADependencyType } from '../../entities/app/bia-process-dependency.entity';
import { BCPPlanStatus } from '../../entities/app/bcp-plan.entity';
import { CorrectiveActionStatus } from '../../entities/app/corrective-action.entity';
import { UserEntity } from '../../entities/auth/user.entity';

config();

// Production safety: Only run demo seed if explicitly allowed
if (process.env.NODE_ENV === 'production' && process.env.DEMO_SEED !== 'true') {
  console.warn('⚠️  Demo seed skipped in production (set DEMO_SEED=true to enable)');
  process.exit(0);
}

const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';

export async function seedPhase15BCMData(dataSource: DataSource) {
  const biaProcessRepo = dataSource.getRepository(BIAProcessEntity);
  const biaDepRepo = dataSource.getRepository(BIAProcessDependencyEntity);
  const bcpPlanRepo = dataSource.getRepository(BCPPlanEntity);
  const bcpExerciseRepo = dataSource.getRepository(BCPExerciseEntity);
  const entityRepo = dataSource.getRepository(EntityEntity);
  const userRepo = dataSource.getRepository(UserEntity);
  const findingRepo = dataSource.getRepository(AuditFindingEntity);
  const capRepo = dataSource.getRepository(CorrectiveActionEntity);
  const riskInstanceRepo = dataSource.getRepository(RiskInstanceEntity);

  console.log('📦 Seeding Phase 15 BCM data...');

  // Find users
  const users = await userRepo.find({
    where: { tenant_id: DEFAULT_TENANT_ID },
    take: 5,
  });
  const ali = users.find((u) => u.email === 'ali.kilic@local') || users[0];
  const ayse = users.find((u) => u.email === 'ayse.demir@local') || users[1];

  // Find entities (by code)
  const appFin = await entityRepo.findOne({
    where: { code: 'APP-FIN', tenant_id: DEFAULT_TENANT_ID },
  });
  const dbFin = await entityRepo.findOne({
    where: { code: 'DB-FIN', tenant_id: DEFAULT_TENANT_ID },
  });
  const appHr = await entityRepo.findOne({
    where: { code: 'APP-HR', tenant_id: DEFAULT_TENANT_ID },
  });
  // Try to find SVC-LOGIN or any service entity
  const svcSso =
    (await entityRepo.findOne({
      where: { code: 'SVC-LOGIN', tenant_id: DEFAULT_TENANT_ID },
    })) ||
    (await entityRepo.findOne({
      where: { tenant_id: DEFAULT_TENANT_ID },
    }));

  // 1. BIA Process: PROC-PAYROLL
  let procPayroll = await biaProcessRepo.findOne({
    where: { code: 'PROC-PAYROLL', tenant_id: DEFAULT_TENANT_ID },
  });

  if (!procPayroll) {
    procPayroll = biaProcessRepo.create({
      id: randomUUID(),
      tenant_id: DEFAULT_TENANT_ID,
      code: 'PROC-PAYROLL',
      name: 'Payroll Processing',
      description:
        'Critical process for employee payments and payroll management',
      owner_user_id: ali?.id,
      criticality: 5,
      rto_hours: 8,
      rpo_hours: 4,
      mtpd_hours: 48,
    });
    await biaProcessRepo.save(procPayroll);
    console.log('✅ Seeded BIA Process: PROC-PAYROLL');
  }

  // 2. BIA Process: PROC-ONBOARDING
  let procOnboarding = await biaProcessRepo.findOne({
    where: { code: 'PROC-ONBOARDING', tenant_id: DEFAULT_TENANT_ID },
  });

  if (!procOnboarding) {
    procOnboarding = biaProcessRepo.create({
      id: randomUUID(),
      tenant_id: DEFAULT_TENANT_ID,
      code: 'PROC-ONBOARDING',
      name: 'Employee Onboarding',
      description: 'New employee onboarding and provisioning process',
      owner_user_id: ayse?.id,
      criticality: 4,
      rto_hours: 24,
      rpo_hours: 8,
      mtpd_hours: 72,
    });
    await biaProcessRepo.save(procOnboarding);
    console.log('✅ Seeded BIA Process: PROC-ONBOARDING');
  }

  // 3. Dependencies for PROC-PAYROLL
  if (appFin) {
    const dep1 = await biaDepRepo.findOne({
      where: {
        process_id: procPayroll.id,
        entity_id: appFin.id,
        tenant_id: DEFAULT_TENANT_ID,
      },
    });
    if (!dep1) {
      await biaDepRepo.save(
        biaDepRepo.create({
          id: randomUUID(),
          tenant_id: DEFAULT_TENANT_ID,
          process_id: procPayroll.id,
          entity_id: appFin.id,
          dependency_type: BIADependencyType.APPLICATION,
        }),
      );
      console.log('   ✅ Dependency: PROC-PAYROLL → APP-FIN');
    }
  }

  if (dbFin) {
    const dep2 = await biaDepRepo.findOne({
      where: {
        process_id: procPayroll.id,
        entity_id: dbFin.id,
        tenant_id: DEFAULT_TENANT_ID,
      },
    });
    if (!dep2) {
      await biaDepRepo.save(
        biaDepRepo.create({
          id: randomUUID(),
          tenant_id: DEFAULT_TENANT_ID,
          process_id: procPayroll.id,
          entity_id: dbFin.id,
          dependency_type: BIADependencyType.DATABASE,
        }),
      );
      console.log('   ✅ Dependency: PROC-PAYROLL → DB-FIN');
    }
  }

  if (svcSso) {
    const dep3 = await biaDepRepo.findOne({
      where: {
        process_id: procPayroll.id,
        entity_id: svcSso.id,
        tenant_id: DEFAULT_TENANT_ID,
      },
    });
    if (!dep3) {
      await biaDepRepo.save(
        biaDepRepo.create({
          id: randomUUID(),
          tenant_id: DEFAULT_TENANT_ID,
          process_id: procPayroll.id,
          entity_id: svcSso.id,
          dependency_type: BIADependencyType.VENDOR,
        }),
      );
      console.log('   ✅ Dependency: PROC-PAYROLL → VND-SSO');
    }
  }

  // 4. Dependencies for PROC-ONBOARDING
  if (appHr) {
    const dep4 = await biaDepRepo.findOne({
      where: {
        process_id: procOnboarding.id,
        entity_id: appHr.id,
        tenant_id: DEFAULT_TENANT_ID,
      },
    });
    if (!dep4) {
      await biaDepRepo.save(
        biaDepRepo.create({
          id: randomUUID(),
          tenant_id: DEFAULT_TENANT_ID,
          process_id: procOnboarding.id,
          entity_id: appHr.id,
          dependency_type: BIADependencyType.APPLICATION,
        }),
      );
      console.log('   ✅ Dependency: PROC-ONBOARDING → APP-HR');
    }
  }

  // 5. BCP Plan: BCP-PAYROLL-001
  let bcpPayroll = await bcpPlanRepo.findOne({
    where: { code: 'BCP-PAYROLL-001', tenant_id: DEFAULT_TENANT_ID },
  });

  if (!bcpPayroll) {
    bcpPayroll = bcpPlanRepo.create({
      id: randomUUID(),
      tenant_id: DEFAULT_TENANT_ID,
      code: 'BCP-PAYROLL-001',
      name: 'Payroll Business Continuity Plan',
      process_id: procPayroll.id,
      version: '1.0',
      status: BCPPlanStatus.APPROVED,
      steps: [
        {
          step: 1,
          title: 'Activate DR Site',
          description: 'Activate disaster recovery site infrastructure',
          owner: 'IT Operations',
        },
        {
          step: 2,
          title: 'Restore Database',
          description:
            'Restore Finance Database from latest backup (RPO: 4 hours)',
          owner: 'Database Team',
        },
        {
          step: 3,
          title: 'Deploy Application',
          description: 'Deploy Financial System application to DR site',
          owner: 'Application Team',
        },
        {
          step: 4,
          title: 'Configure SSO',
          description: 'Configure SSO authentication service',
          owner: 'Security Team',
        },
        {
          step: 5,
          title: 'Validate Data Integrity',
          description: 'Verify data integrity and run validation tests',
          owner: 'Finance Team',
        },
        {
          step: 6,
          title: 'Resume Payroll Operations',
          description: 'Resume payroll processing operations',
          owner: 'HR Operations',
        },
      ],
    });
    await bcpPlanRepo.save(bcpPayroll);
    console.log('✅ Seeded BCP Plan: BCP-PAYROLL-001');
  }

  // 6. BCP Plan: DR-LOGIN-001
  let drLogin = await bcpPlanRepo.findOne({
    where: { code: 'DR-LOGIN-001', tenant_id: DEFAULT_TENANT_ID },
  });

  if (!drLogin) {
    drLogin = bcpPlanRepo.create({
      id: randomUUID(),
      tenant_id: DEFAULT_TENANT_ID,
      code: 'DR-LOGIN-001',
      name: 'Login Service Disaster Recovery Plan',
      scope_entity_id: svcSso?.id,
      version: '1.0',
      status: BCPPlanStatus.APPROVED,
      steps: [
        {
          step: 1,
          title: 'Failover to Secondary',
          description:
            'Switch authentication traffic to secondary login service',
          owner: 'Platform Team',
        },
        {
          step: 2,
          title: 'Verify Service Health',
          description: 'Monitor service health and response times',
          owner: 'SRE Team',
        },
        {
          step: 3,
          title: 'Notify Stakeholders',
          description: 'Notify all dependent services and applications',
          owner: 'Communication Team',
        },
      ],
    });
    await bcpPlanRepo.save(drLogin);
    console.log('✅ Seeded BCP Plan: DR-LOGIN-001');
  }

  // 7. BCP Exercise: EX-DR-LOGIN-APR
  let exercise = await bcpExerciseRepo.findOne({
    where: { code: 'EX-DR-LOGIN-APR', tenant_id: DEFAULT_TENANT_ID },
  });

  if (!exercise) {
    exercise = bcpExerciseRepo.create({
      id: randomUUID(),
      tenant_id: DEFAULT_TENANT_ID,
      plan_id: drLogin.id,
      code: 'EX-DR-LOGIN-APR',
      name: 'Login Service DR Exercise - April 2025',
      date: new Date('2025-04-15'),
      scenario:
        'Simulated login service outage - failover to secondary service',
      result:
        'DR plan executed successfully. RTO met (within 2 hours). Minor findings identified requiring plan updates.',
      findings_count: 2,
      caps_count: 1,
    });
    await bcpExerciseRepo.save(exercise);
    console.log('✅ Seeded BCP Exercise: EX-DR-LOGIN-APR');
  }

  // 8. Mini Chain Scenario: Risk Instance → Audit Finding → CAP → BIA Process
  // Find or create a risk instance
  let riskInstance = await riskInstanceRepo.findOne({
    where: { tenant_id: DEFAULT_TENANT_ID },
    order: { created_at: 'DESC' },
  });

  // Find or create an audit finding
  let finding = await findingRepo.findOne({
    where: { tenant_id: DEFAULT_TENANT_ID },
    order: { created_at: 'DESC' },
  });

  if (!finding) {
    // Create a minimal finding if none exists
    finding = findingRepo.create({
      id: randomUUID(),
      tenant_id: DEFAULT_TENANT_ID,
      engagement_id: randomUUID(), // Placeholder - would need actual engagement
      severity: 'high' as any,
      title: 'Payroll System Access Control Gap',
      details: 'Identified during Phase 15 BCM seed - requires corrective action',
      status: 'open' as any,
    });
    finding = await findingRepo.save(finding);
    console.log('   ✅ Created Audit Finding for chain scenario');
  }

  // Link Finding to Risk Instance (if exists)
  if (riskInstance && finding) {
    finding.risk_instance_id = riskInstance.id;
    await findingRepo.save(finding);
    console.log('   ✅ Linked Finding to Risk Instance');
  }

  // Link Finding to BIA Process
  if (finding && procPayroll) {
    finding.bia_process_id = procPayroll.id;
    await findingRepo.save(finding);
    console.log(
      `✅ Linked Audit Finding ${finding.id} to BIA Process PROC-PAYROLL`,
    );
  }

  // Create CAP (Corrective Action) linked to Finding
  let cap = await capRepo.findOne({
    where: {
      finding_id: finding.id,
      tenant_id: DEFAULT_TENANT_ID,
    },
  });

  if (!cap && finding) {
    cap = capRepo.create({
      id: randomUUID(),
      tenant_id: DEFAULT_TENANT_ID,
      finding_id: finding.id,
      title: 'Implement Enhanced Access Controls for Payroll System',
      description:
        'Apply MFA and role-based access controls to mitigate unauthorized access risk',
      assignee_user_id: ali?.id,
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      status: CorrectiveActionStatus.OPEN,
    });
    cap = await capRepo.save(cap);
    console.log('   ✅ Created CAP (open) linked to Finding');
  }

  console.log('✅ Phase 15 BCM seed completed (with chain scenario)');
}

// Main execution
if (require.main === module) {
  (async () => {
    try {
      const ds = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        username: process.env.DB_USER || 'grc',
        password: process.env.DB_PASS || '123456',
        database: process.env.DB_NAME || 'grc',
        synchronize: false,
        logging: process.env.DB_LOGGING === 'true',
        entities: [__dirname + '/../../entities/**/*.entity{.ts,.js}'],
      });

      await ds.initialize();
      console.log('✅ Database connected for Phase 15 BCM Seed');

      await seedPhase15BCMData(ds);

      await ds.destroy();
      console.log('✅ Phase 15 seed script completed');
      process.exit(0);
    } catch (error: any) {
      console.error('❌ Phase 15 seed failed:', error);
      process.exit(1);
    }
  })();
}
