import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  AuditPlanEntity,
  AuditEngagementEntity,
  AuditTestEntity,
  AuditEvidenceEntity,
  AuditFindingEntity,
  CorrectiveActionEntity,
  RiskInstanceEntity,
  PolicyEntity,
  StandardClauseEntity,
  ControlLibraryEntity,
} from '../../entities/app';
import { UserEntity } from '../../entities/auth/user.entity';
import { AuditPlanStatus } from '../../entities/app/audit-plan.entity';
import { AuditEngagementStatus } from '../../entities/app/audit-engagement.entity';
import { AuditTestStatus } from '../../entities/app/audit-test.entity';
import {
  AuditFindingSeverity,
  AuditFindingStatus,
} from '../../entities/app/audit-finding.entity';
import { CorrectiveActionStatus } from '../../entities/app/corrective-action.entity';
import { AuditEvidenceType } from '../../entities/app/audit-evidence.entity';

const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';

export async function seedPhase14AuditData(dataSource: DataSource) {
  const planRepo = dataSource.getRepository(AuditPlanEntity);
  const engagementRepo = dataSource.getRepository(AuditEngagementEntity);
  const testRepo = dataSource.getRepository(AuditTestEntity);
  const evidenceRepo = dataSource.getRepository(AuditEvidenceEntity);
  const findingRepo = dataSource.getRepository(AuditFindingEntity);
  const capRepo = dataSource.getRepository(CorrectiveActionEntity);
  const userRepo = dataSource.getRepository(UserEntity);
  const riskInstanceRepo = dataSource.getRepository(RiskInstanceEntity);
  const policyRepo = dataSource.getRepository(PolicyEntity);
  const controlRepo = dataSource.getRepository(ControlLibraryEntity);

  // Find users
  const users = await userRepo.find({
    where: { tenant_id: DEFAULT_TENANT_ID },
    take: 5,
  });
  const leadAuditor = users[0] || null;

  // Find SVC-LOGIN risk instance
  const svcLoginRisk = await riskInstanceRepo.findOne({
    where: { tenant_id: DEFAULT_TENANT_ID },
    relations: ['catalog'],
  });
  // Find any risk instance if SVC-LOGIN doesn't exist
  const anyRiskInstance =
    svcLoginRisk ||
    (await riskInstanceRepo.findOne({
      where: { tenant_id: DEFAULT_TENANT_ID },
    }));

  // Find POL-AC-001 policy
  const polAc001 = await policyRepo.findOne({
    where: { code: 'POL-AC-001', tenant_id: DEFAULT_TENANT_ID },
  });

  // Find CTRL-MFA control
  const ctrlMfa = await controlRepo.findOne({
    where: { code: 'CTRL-MFA', tenant_id: DEFAULT_TENANT_ID },
  });

  // 1. Audit Plan: AP-2025-H2
  let auditPlan = await planRepo.findOne({
    where: { code: 'AP-2025-H2', tenant_id: DEFAULT_TENANT_ID },
  });

  if (!auditPlan) {
    auditPlan = planRepo.create({
      id: randomUUID(),
      tenant_id: DEFAULT_TENANT_ID,
      code: 'AP-2025-H2',
      name: '2025 H2 Audit Plan',
      period_start: new Date('2025-07-01'),
      period_end: new Date('2025-12-31'),
      scope: 'Core services & critical apps',
      status: AuditPlanStatus.IN_PROGRESS,
    });
    await planRepo.save(auditPlan);
    console.log('✅ Seeded Audit Plan: AP-2025-H2');
  }

  // 2. Engagement: AE-LOGIN-001
  let engagement = await engagementRepo.findOne({
    where: { code: 'AE-LOGIN-001', tenant_id: DEFAULT_TENANT_ID },
  });

  if (!engagement) {
    engagement = engagementRepo.create({
      id: randomUUID(),
      tenant_id: DEFAULT_TENANT_ID,
      plan_id: auditPlan.id,
      code: 'AE-LOGIN-001',
      name: 'Auth & Login Service Audit',
      auditee: 'Auth & Login Service',
      lead_auditor_id: leadAuditor?.id,
      status: AuditEngagementStatus.IN_PROGRESS,
    });
    await engagementRepo.save(engagement);
    console.log('✅ Seeded Engagement: AE-LOGIN-001');
  }

  // 3. Tests
  let testMfa = await testRepo.findOne({
    where: { code: 'AT-CTRL-MFA-EXISTENCE', tenant_id: DEFAULT_TENANT_ID },
  });

  if (!testMfa) {
    testMfa = testRepo.create({
      id: randomUUID(),
      tenant_id: DEFAULT_TENANT_ID,
      engagement_id: engagement.id,
      code: 'AT-CTRL-MFA-EXISTENCE',
      name: 'MFA Control Existence Test',
      objective: 'Verify MFA control is implemented on login service',
      population_ref: 'All login endpoints',
      status: AuditTestStatus.IN_PROGRESS,
    });
    await testRepo.save(testMfa);
    console.log('✅ Seeded Test: AT-CTRL-MFA-EXISTENCE');
  }

  let testLogMon = await testRepo.findOne({
    where: { code: 'AT-LOG-MON', tenant_id: DEFAULT_TENANT_ID },
  });

  if (!testLogMon) {
    testLogMon = testRepo.create({
      id: randomUUID(),
      tenant_id: DEFAULT_TENANT_ID,
      engagement_id: engagement.id,
      code: 'AT-LOG-MON',
      name: 'Log & Monitoring Test',
      objective: 'Verify log and monitoring adequacy',
      status: AuditTestStatus.IN_PROGRESS,
    });
    await testRepo.save(testLogMon);
    console.log('✅ Seeded Test: AT-LOG-MON');
  }

  // 4. Evidences
  const evidence1 = await evidenceRepo.findOne({
    where: { test_id: testMfa.id, tenant_id: DEFAULT_TENANT_ID },
  });

  if (!evidence1) {
    const ev1 = evidenceRepo.create({
      id: randomUUID(),
      tenant_id: DEFAULT_TENANT_ID,
      test_id: testMfa.id,
      type: AuditEvidenceType.NOTE,
      uri_or_text: 'MFA not enabled on APP-FIN and SVC-LOGIN endpoints',
      collected_at: new Date(),
      collected_by: leadAuditor?.id,
    });
    await evidenceRepo.save(ev1);
    console.log('✅ Seeded Evidence for AT-CTRL-MFA-EXISTENCE');
  }

  // 5. Finding: AF-LOGIN-MFA-GAP
  let finding = await findingRepo.findOne({
    where: { title: 'AF-LOGIN-MFA-GAP', tenant_id: DEFAULT_TENANT_ID },
  });

  // Check by title since we don't have code field
  const existingFindings = await findingRepo.find({
    where: {
      engagement_id: engagement.id,
      tenant_id: DEFAULT_TENANT_ID,
    },
  });
  const findingByTitle = existingFindings.find((f) =>
    f.title.includes('MFA Gap'),
  );

  if (!findingByTitle) {
    finding = findingRepo.create({
      id: randomUUID(),
      tenant_id: DEFAULT_TENANT_ID,
      engagement_id: engagement.id,
      test_id: testMfa.id,
      severity: AuditFindingSeverity.HIGH,
      title: 'MFA Gap in Critical Services',
      details: 'MFA not enabled on APP-FIN & SVC-LOGIN',
      status: AuditFindingStatus.OPEN,
      due_date: new Date('2025-02-15'),
      risk_instance_id: anyRiskInstance?.id,
      policy_id: polAc001?.id,
      control_id: ctrlMfa?.id,
    });
    await findingRepo.save(finding);
    console.log('✅ Seeded Finding: MFA Gap in Critical Services');
  } else {
    finding = findingByTitle;
  }

  // 6. CAP: Enable MFA on APP-FIN & SVC-LOGIN
  const capTitle = 'Enable MFA on APP-FIN & SVC-LOGIN';
  const existingCAP = await capRepo.findOne({
    where: {
      finding_id: finding.id,
      tenant_id: DEFAULT_TENANT_ID,
    },
  });

  if (!existingCAP) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    const cap = capRepo.create({
      id: randomUUID(),
      tenant_id: DEFAULT_TENANT_ID,
      finding_id: finding.id,
      title: capTitle,
      description: 'Implement MFA controls on APP-FIN and SVC-LOGIN services',
      assignee_user_id: leadAuditor?.id,
      due_date: dueDate,
      status: CorrectiveActionStatus.OPEN,
    });
    await capRepo.save(cap);
    console.log('✅ Seeded CAP: Enable MFA on APP-FIN & SVC-LOGIN');
  }

  console.log('✅ Phase 14 Audit seed completed');
}
