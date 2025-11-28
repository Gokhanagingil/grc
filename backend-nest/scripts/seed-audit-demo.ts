#!/usr/bin/env ts-node
/**
 * Seed Audit Demo Data
 * 
 * Creates realistic demo audit data based on real standards:
 * - ISO/IEC 27001:2022
 * - ISO 31000:2018
 * - ISO 9001:2015
 * 
 * Creates:
 * - Audit Plans
 * - Audit Engagements
 * - Audit Findings
 * - Corrective Action Plans (CAPs)
 * 
 * Usage: npm run seed:audit-demo
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { TenantEntity } from '../src/entities/tenant/tenant.entity';
import { StandardEntity } from '../src/entities/app/standard.entity';
import { StandardClauseEntity } from '../src/entities/app/standard-clause.entity';
import { AuditPlanEntity, AuditPlanStatus } from '../src/entities/app/audit-plan.entity';
import { AuditEngagementEntity, AuditEngagementStatus } from '../src/entities/app/audit-engagement.entity';
import { AuditTestEntity } from '../src/entities/app/audit-test.entity';
import { AuditEvidenceEntity } from '../src/entities/app/audit-evidence.entity';
import { AuditFindingEntity, AuditFindingSeverity, AuditFindingStatus } from '../src/entities/app/audit-finding.entity';
import { CorrectiveActionEntity, CorrectiveActionStatus } from '../src/entities/app/corrective-action.entity';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';

// Demo audit plans
const auditPlans = [
  {
    code: 'AUD-2025-ISO27001-001',
    name: '2025 ISO 27001 Internal Audit – Data Center & Managed Services',
    period_start: '2025-01-01',
    period_end: '2025-12-31',
    scope: 'Internal audit of ISO/IEC 27001:2022 compliance covering data center operations, managed services, and information security management system.',
    status: AuditPlanStatus.IN_PROGRESS,
    engagements: [
      {
        code: 'ENG-2025-ISO27001-DC-001',
        name: 'Data Center Security Controls Audit',
        auditee: 'IT Operations Team',
        status: AuditEngagementStatus.IN_PROGRESS,
        findings: [
          {
            title: 'Insufficient access control review process',
            description: 'Access control reviews are not conducted on a regular basis. Some user accounts have not been reviewed in over 12 months.',
            details: 'During the audit, it was found that the access control review process (ISO 27001 A.9.2.1) is not being followed consistently. Several user accounts with elevated privileges have not been reviewed in accordance with the policy.',
            severity: AuditFindingSeverity.HIGH,
            status: AuditFindingStatus.OPEN,
            due_date: '2025-03-15',
            clause_code: 'A.9.2.1',
            caps: [
              {
                code: 'CAP-2025-001',
                title: 'Implement quarterly access control reviews',
                description: 'Establish a quarterly review process for all user accounts, with special attention to accounts with elevated privileges. Document the review process and assign responsibility to the IT Security Manager.',
                due_date: '2025-03-15',
                status: CorrectiveActionStatus.IN_PROGRESS,
              },
            ],
          },
          {
            title: 'Missing documentation for cryptographic controls',
            description: 'Cryptographic controls policy exists but implementation documentation is incomplete.',
            details: 'The organization has a policy on cryptographic controls (ISO 27001 A.10.1.1) but lacks detailed documentation on how cryptographic controls are implemented, key management procedures, and encryption standards.',
            severity: AuditFindingSeverity.MEDIUM,
            status: AuditFindingStatus.IN_PROGRESS,
            due_date: '2025-04-30',
            clause_code: 'A.10.1.1',
            caps: [
              {
                code: 'CAP-2025-002',
                title: 'Document cryptographic control implementation',
                description: 'Create comprehensive documentation covering encryption algorithms, key management procedures, and encryption standards for data at rest and in transit.',
                due_date: '2025-04-30',
                status: CorrectiveActionStatus.OPEN,
              },
            ],
          },
        ],
      },
      {
        code: 'ENG-2025-ISO27001-ISMS-001',
        name: 'ISMS Policy and Governance Audit',
        auditee: 'Information Security Team',
        status: AuditEngagementStatus.COMPLETED,
        findings: [
          {
            title: 'Information security policy not reviewed annually',
            description: 'The information security policy (ISO 27001 A.5.1.1) has not been reviewed in the past 18 months.',
            details: 'According to the policy, the information security policy should be reviewed annually. The last review was conducted 18 months ago, and no review has been scheduled for the current year.',
            severity: AuditFindingSeverity.MEDIUM,
            status: AuditFindingStatus.CLOSED,
            due_date: '2025-02-28',
            clause_code: 'A.5.1.1',
            caps: [
              {
                code: 'CAP-2025-003',
                title: 'Schedule and conduct annual policy review',
                description: 'Schedule the annual information security policy review for Q1 2025 and ensure it is conducted with management participation.',
                due_date: '2025-02-28',
                status: CorrectiveActionStatus.DONE,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    code: 'AUD-2025-ISO9001-001',
    name: '2025 ISO 9001 Process & Quality Audit',
    period_start: '2025-01-01',
    period_end: '2025-12-31',
    scope: 'Internal audit of ISO 9001:2015 quality management system covering product development, customer service, and continuous improvement processes.',
    status: AuditPlanStatus.IN_PROGRESS,
    engagements: [
      {
        code: 'ENG-2025-ISO9001-QMS-001',
        name: 'Quality Management System Internal Audit',
        auditee: 'Quality Assurance Team',
        status: AuditEngagementStatus.IN_PROGRESS,
        findings: [
          {
            title: 'Internal audit not conducted as planned',
            description: 'The internal audit (ISO 9001 9.2) scheduled for Q4 2024 was not conducted.',
            details: 'According to the audit schedule, an internal audit of the quality management system should have been conducted in Q4 2024. The audit was postponed and has not been rescheduled.',
            severity: AuditFindingSeverity.MEDIUM,
            status: AuditFindingStatus.OPEN,
            due_date: '2025-03-31',
            clause_code: '9.2',
            caps: [
              {
                code: 'CAP-2025-004',
                title: 'Reschedule and conduct delayed internal audit',
                description: 'Reschedule the Q4 2024 internal audit for Q1 2025 and ensure it is conducted according to the audit plan. Update the audit schedule to prevent future delays.',
                due_date: '2025-03-31',
                status: CorrectiveActionStatus.OPEN,
              },
            ],
          },
          {
            title: 'Nonconformity corrective action process not fully documented',
            description: 'Some nonconformities identified in previous audits do not have complete corrective action documentation (ISO 9001 10.2).',
            details: 'Review of previous audit records shows that corrective actions for some nonconformities lack root cause analysis and effectiveness verification documentation.',
            severity: AuditFindingSeverity.LOW,
            status: AuditFindingStatus.IN_PROGRESS,
            due_date: '2025-05-15',
            clause_code: '10.2',
            caps: [
              {
                code: 'CAP-2025-005',
                title: 'Complete corrective action documentation',
                description: 'Review all open nonconformities and ensure each has complete documentation including root cause analysis, corrective action plan, and effectiveness verification.',
                due_date: '2025-05-15',
                status: CorrectiveActionStatus.IN_PROGRESS,
              },
            ],
          },
        ],
      },
    ],
  },
];

async function run() {
  const entities = [
    TenantEntity,
    StandardEntity,
    StandardClauseEntity,
    AuditPlanEntity,
    AuditEngagementEntity,
    AuditTestEntity,
    AuditEvidenceEntity,
    AuditFindingEntity,
    CorrectiveActionEntity,
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

  const findStandardClause = async (
    ds: DataSource,
    tenantId: string,
    standardCode: string,
    clauseCode: string,
  ): Promise<StandardClauseEntity | null> => {
    const standardRepo = ds.getRepository(StandardEntity);
    const standard = await standardRepo.findOne({
      where: { code: standardCode, tenant_id: tenantId },
    });

    if (!standard) {
      return null;
    }

    const clauseRepo = ds.getRepository(StandardClauseEntity);
    const clause = await clauseRepo.findOne({
      where: {
        standard_id: standard.id,
        clause_code: clauseCode,
        tenant_id: tenantId,
      },
    });

    return clause;
  };

  const ensureAuditPlan = async (
    ds: DataSource,
    tenantId: string,
    planData: typeof auditPlans[0],
  ) => {
    const planRepo = ds.getRepository(AuditPlanEntity);
    let plan = await planRepo.findOne({
      where: { code: planData.code, tenant_id: tenantId },
    });

    if (plan) {
      // Update existing plan
      plan.name = planData.name;
      plan.period_start = new Date(planData.period_start);
      plan.period_end = new Date(planData.period_end);
      plan.scope = planData.scope;
      plan.status = planData.status;
      plan = await planRepo.save(plan);
      console.log(`✅ Updated audit plan: ${planData.code}`);
    } else {
      // Create new plan
      plan = planRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        code: planData.code,
        name: planData.name,
        period_start: new Date(planData.period_start),
        period_end: new Date(planData.period_end),
        scope: planData.scope,
        status: planData.status,
      });
      plan = await planRepo.save(plan);
      console.log(`✅ Created audit plan: ${planData.code}`);
    }

    // Create/update engagements
    const engagementRepo = ds.getRepository(AuditEngagementEntity);
    for (const engagementData of planData.engagements) {
      let engagement = await engagementRepo.findOne({
        where: { code: engagementData.code, tenant_id: tenantId },
      });

      if (engagement) {
        engagement.name = engagementData.name;
        engagement.auditee = engagementData.auditee;
        engagement.status = engagementData.status;
        engagement.plan_id = plan.id;
        engagement = await engagementRepo.save(engagement);
        console.log(`  ✅ Updated engagement: ${engagementData.code}`);
      } else {
        engagement = engagementRepo.create({
          id: randomUUID(),
          tenant_id: tenantId,
          plan_id: plan.id,
          code: engagementData.code,
          name: engagementData.name,
          auditee: engagementData.auditee,
          status: engagementData.status,
        });
        engagement = await engagementRepo.save(engagement);
        console.log(`  ✅ Created engagement: ${engagementData.code}`);
      }

      // Create/update findings
      const findingRepo = ds.getRepository(AuditFindingEntity);
      for (const findingData of engagementData.findings) {
        // Find clause if specified
        let clauseId: string | undefined = undefined;
        if (findingData.clause_code) {
          // Determine standard code from plan name
          let standardCode = 'ISO27001';
          if (planData.name.includes('ISO 9001')) {
            standardCode = 'ISO9001';
          } else if (planData.name.includes('ISO 31000')) {
            standardCode = 'ISO31000';
          }

          const clause = await findStandardClause(ds, tenantId, standardCode, findingData.clause_code);
          if (clause) {
            clauseId = clause.id;
          }
        }

        let finding = await findingRepo.findOne({
          where: {
            engagement_id: engagement.id,
            title: findingData.title,
            tenant_id: tenantId,
          },
        });

        if (finding) {
          finding.description = findingData.description;
          finding.details = findingData.details;
          finding.severity = findingData.severity;
          finding.status = findingData.status;
          finding.due_date = findingData.due_date ? new Date(findingData.due_date) : undefined;
          finding.clause_id = clauseId;
          finding = await findingRepo.save(finding);
          console.log(`    ✅ Updated finding: ${findingData.title}`);
        } else {
          finding = findingRepo.create({
            id: randomUUID(),
            tenant_id: tenantId,
            engagement_id: engagement.id,
            title: findingData.title,
            description: findingData.description,
            details: findingData.details,
            severity: findingData.severity,
            status: findingData.status,
            due_date: findingData.due_date ? new Date(findingData.due_date) : undefined,
            clause_id: clauseId,
          });
          finding = await findingRepo.save(finding);
          console.log(`    ✅ Created finding: ${findingData.title}`);
        }

        // Create/update CAPs
        const capRepo = ds.getRepository(CorrectiveActionEntity);
        for (const capData of findingData.caps) {
          let cap = await capRepo.findOne({
            where: {
              finding_id: finding.id,
              code: capData.code,
              tenant_id: tenantId,
            },
          });

          if (cap) {
            cap.title = capData.title;
            cap.description = capData.description;
            cap.due_date = capData.due_date ? new Date(capData.due_date) : undefined;
            cap.status = capData.status;
            cap = await capRepo.save(cap);
            console.log(`      ✅ Updated CAP: ${capData.code}`);
          } else {
            cap = capRepo.create({
              id: randomUUID(),
              tenant_id: tenantId,
              finding_id: finding.id,
              code: capData.code,
              title: capData.title,
              description: capData.description,
              due_date: capData.due_date ? new Date(capData.due_date) : undefined,
              status: capData.status,
            });
            cap = await capRepo.save(cap);
            console.log(`      ✅ Created CAP: ${capData.code}`);
          }
        }
      }
    }

    return plan;
  };

  const options = determineDataSourceOptions();
  const dataSource = new DataSource(options);

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');
    console.log('🌱 Starting audit demo seed...\n');

    const tenant = await ensureTenant(dataSource);
    console.log('');

    for (const planData of auditPlans) {
      await ensureAuditPlan(dataSource, tenant.id, planData);
      console.log('');
    }

    console.log('✅ Audit demo seed completed');
  } catch (error) {
    console.error('❌ Audit demo seed failed', error);
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

