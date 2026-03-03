/**
 * DEMO SEED PACK — Idempotent, tenant-safe demo data for STAGING/demo usage.
 *
 * Creates meaningful, interconnected data for GRC + ITSM + BCM suitable for
 * UI demos, reporting, and end-to-end flows. Includes two full narrative
 * demo scenarios (Scenario 1: Ops → Problem → KE → Risk; Scenario 2: Change
 * Risk → Control Evidence Gap → Follow-up).
 *
 * HARD RULES:
 * - Idempotent: deterministic IDs / natural keys + upsert.
 * - Tenant-safe: single demo tenant (DEMO_TENANT_ID).
 * - No real PII: fake names/emails, .local domains.
 * - Internally consistent links, statuses, dates, ownership.
 *
 * DEPENDENCIES: Run seed:grc, seed:standards, seed:core-companies first
 * (or ensure demo tenant, standards with clauses, and at least one company exist).
 *
 * Usage:
 *   npm run seed:demo:pack        (after build)
 *   npm run seed:demo:pack:dev   (ts-node)
 */

process.env.JOBS_ENABLED = 'false';

const SEED_TIMEOUT_MS = parseInt(process.env.SEED_TIMEOUT_MS || '180000', 10);
const safetyTimer = setTimeout(() => {
  console.error(
    `[SEED-DEMO-PACK] FATAL: Safety timeout (${SEED_TIMEOUT_MS}ms). Exiting.`,
  );
  process.exit(2);
}, SEED_TIMEOUT_MS);
safetyTimer.unref();

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../app.module';

// Tenant & identity
import { Tenant } from '../tenants/tenant.entity';
import { User, UserRole } from '../users/user.entity';
import { CoreCompany } from '../core-company/core-company.entity';
import { CompanyType, CompanyStatus } from '../core-company/core-company.enum';

// GRC
import { GrcControl } from '../grc/entities/grc-control.entity';
import { GrcRisk } from '../grc/entities/grc-risk.entity';
import { GrcRiskControl } from '../grc/entities/grc-risk-control.entity';
import { GrcRequirement } from '../grc/entities/grc-requirement.entity';
import { GrcAudit } from '../grc/entities/grc-audit.entity';
import { GrcAuditRequirement } from '../grc/entities/grc-audit-requirement.entity';
import { GrcIssue } from '../grc/entities/grc-issue.entity';
import { GrcCapa } from '../grc/entities/grc-capa.entity';
import { GrcCapaTask } from '../grc/entities/grc-capa-task.entity';
import { GrcEvidence } from '../grc/entities/grc-evidence.entity';
import {
  RiskSeverity,
  RiskLikelihood,
  RiskStatus,
  TreatmentStrategy,
  RiskAppetite,
} from '../grc/enums';
import { AuditStatus, AuditType, AuditRiskLevel } from '../grc/entities/grc-audit.entity';
import { AuditRequirementStatus } from '../grc/entities/grc-audit-requirement.entity';
import { CapaType, CapaStatus, CAPAPriority, CAPATaskStatus } from '../grc/enums';
import { EvidenceStatus, IssueType, IssueStatus, IssueSeverity } from '../grc/enums';

// ITSM
import { ItsmChangeTemplate } from '../itsm/change/template/change-template.entity';
import { ItsmChangeTemplateTask } from '../itsm/change/template/change-template-task.entity';
import {
  ItsmChange,
  ChangeType,
  ChangeState,
  ChangeRisk,
  ChangeApprovalStatus,
} from '../itsm/change/change.entity';
import { CmdbService } from '../itsm/cmdb/service/cmdb-service.entity';
import { ItsmIncident } from '../itsm/incident/incident.entity';
import { ItsmMajorIncident } from '../itsm/major-incident/major-incident.entity';
import { ItsmMajorIncidentUpdate } from '../itsm/major-incident/major-incident-update.entity';
import { ItsmMajorIncidentLink } from '../itsm/major-incident/major-incident-link.entity';
import { ItsmProblem } from '../itsm/problem/problem.entity';
import { ItsmProblemIncident } from '../itsm/problem/problem-incident.entity';
import { ItsmProblemChange } from '../itsm/problem/problem-change.entity';
import { ItsmKnownError } from '../itsm/known-error/known-error.entity';
import {
  IncidentCategory,
  IncidentImpact,
  IncidentUrgency,
  IncidentPriority,
  IncidentStatus,
  IncidentSource,
} from '../itsm/enums';
import {
  ProblemState,
  ProblemPriority,
  ProblemImpact,
  ProblemUrgency,
  ProblemCategory,
  ProblemSource,
  ProblemIncidentLinkType,
  ProblemChangeLinkType,
  RootCauseCategory,
  KnownErrorState,
  KnownErrorFixStatus,
} from '../itsm/enums';
import {
  MajorIncidentStatus,
  MajorIncidentSeverity,
  MajorIncidentLinkType,
  MajorIncidentUpdateType,
  MajorIncidentUpdateVisibility,
} from '../itsm/major-incident/major-incident.enums';
import { ChangeTaskType, ChangeTaskStatus } from '../itsm/change/task/change-task.entity';

// ============================================================================
// DEMO CONSTANTS — Deterministic for idempotency
// ============================================================================

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

/** Assignment group names (used as string on incidents/problems) */
const ASSIGNMENT_GROUPS = [
  'SRE - Core Platform',
  'Infrastructure - Database',
  'Security Operations',
  'Application Support',
  'Network Services',
];

/** Scenario 1 — Database connection pool exhaustion */
const SC1 = {
  TPL_ID: 'd1000001-0001-4000-a000-000000000001',
  CHG_ID: 'd1000001-0001-4000-a000-000000000002',
  INC1_ID: 'd1000001-0001-4000-a000-000000000003',
  INC2_ID: 'd1000001-0001-4000-a000-000000000004',
  INC3_ID: 'd1000001-0001-4000-a000-000000000005',
  MI_ID: 'd1000001-0001-4000-a000-000000000006',
  PRB_ID: 'd1000001-0001-4000-a000-000000000007',
  KE_ID: 'd1000001-0001-4000-a000-000000000008',
  RISK_ID: 'd1000001-0001-4000-a000-000000000009',
  ISSUE_ID: 'd1000001-0001-4000-a000-00000000000a',
  CAPA_ID: 'd1000001-0001-4000-a000-00000000000b',
  SVC_ID: 'd1000001-0001-4000-a000-00000000000c',
};

/** Scenario 2 — Emergency security patch during freeze */
const SC2 = {
  CHG_ID: 'd2000002-0002-4000-a000-000000000001',
  INC_ID: 'd2000002-0002-4000-a000-000000000002',
  AUDIT_ID: 'd2000002-0002-4000-a000-000000000003',
  RISK_ID: 'd2000002-0002-4000-a000-000000000004',
};

/** Demo company code for linking */
const DEMO_COMPANY_CODE = 'DEMO-CUST';

// ============================================================================
// HELPERS
// ============================================================================

function hoursAgo(h: number): Date {
  const now = new Date();
  return new Date(now.getTime() - h * 60 * 60 * 1000);
}

function daysAgo(d: number): Date {
  const now = new Date();
  return new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
}

async function ensureDemoTenantAndAdmin(ds: DataSource) {
  const tenantRepo = ds.getRepository(Tenant);
  let tenant = await tenantRepo.findOne({ where: { id: DEMO_TENANT_ID } });
  if (!tenant) {
    tenant = tenantRepo.create({
      id: DEMO_TENANT_ID,
      name: 'Demo Organization',
      description: 'Demo tenant for GRC platform',
    });
    await tenantRepo.save(tenant);
    console.log('   Created demo tenant');
  }

  const userRepo = ds.getRepository(User);
  let admin = await userRepo.findOne({ where: { id: DEMO_ADMIN_ID } });
  if (!admin) {
    const passwordHash = await bcrypt.hash(
      process.env.DEMO_ADMIN_PASSWORD || 'TestPassword123!',
      10,
    );
    admin = userRepo.create({
      id: DEMO_ADMIN_ID,
      email: process.env.DEMO_ADMIN_EMAIL || 'admin@grc-platform.local',
      firstName: 'Demo',
      lastName: 'Admin',
      passwordHash,
      role: UserRole.ADMIN,
      tenantId: DEMO_TENANT_ID,
    });
    await userRepo.save(admin);
    console.log('   Created demo admin');
  }
  return { tenant, admin };
}

async function ensureDemoCompany(ds: DataSource): Promise<string> {
  const repo = ds.getRepository(CoreCompany);
  let company = await repo.findOne({
    where: { tenantId: DEMO_TENANT_ID, code: DEMO_COMPANY_CODE, isDeleted: false },
  });
  if (!company) {
    company = repo.create({
      tenantId: DEMO_TENANT_ID,
      name: 'Demo Customer Corp',
      code: DEMO_COMPANY_CODE,
      status: CompanyStatus.ACTIVE,
      type: CompanyType.CUSTOMER,
      domain: 'demo-customer.local',
      country: 'Demo Country',
      notes: 'Demo customer for staging/demo flows.',
      createdBy: DEMO_ADMIN_ID,
      isDeleted: false,
    });
    await repo.save(company);
    console.log('   Created demo company: DEMO-CUST');
  }
  return company.id;
}

async function ensureDemoUsers(ds: DataSource): Promise<{ endUserIds: string[]; techIds: string[] }> {
  const userRepo = ds.getRepository(User);
  const defaultHash = await bcrypt.hash('DemoPass123!', 10);
  const endUserIds: string[] = [];
  const techIds: string[] = [];

  for (let i = 1; i <= 20; i++) {
    const email = `user${String(i).padStart(2, '0')}@demo.local`;
    let u = await userRepo.findOne({ where: { email } });
    if (!u) {
      u = userRepo.create({
        email,
        firstName: `Demo`,
        lastName: `User${i}`,
        passwordHash: defaultHash,
        role: UserRole.USER,
        tenantId: DEMO_TENANT_ID,
        isActive: true,
      });
      await userRepo.save(u);
    }
    endUserIds.push(u.id);
  }

  for (let i = 1; i <= 20; i++) {
    const email = `tech${String(i).padStart(2, '0')}@demo.local`;
    let u = await userRepo.findOne({ where: { email } });
    if (!u) {
      u = userRepo.create({
        email,
        firstName: `Demo`,
        lastName: `Tech${i}`,
        passwordHash: defaultHash,
        role: UserRole.MANAGER,
        tenantId: DEMO_TENANT_ID,
        isActive: true,
      });
      await userRepo.save(u);
    }
    techIds.push(u.id);
  }

  console.log(`   End users: ${endUserIds.length}, Technicians: ${techIds.length}`);
  return { endUserIds, techIds };
}

// ============================================================================
// SCENARIO 1 — Database connection pool exhaustion
// ============================================================================

async function seedScenario1(
  ds: DataSource,
  companyId: string,
  techIds: string[],
  controls: GrcControl[],
  stats: { created: number; reused: number },
) {
  const tplRepo = ds.getRepository(ItsmChangeTemplate);
  const tplTaskRepo = ds.getRepository(ItsmChangeTemplateTask);
  const changeRepo = ds.getRepository(ItsmChange);
  const svcRepo = ds.getRepository(CmdbService);
  const incRepo = ds.getRepository(ItsmIncident);
  const miRepo = ds.getRepository(ItsmMajorIncident);
  const miUpdateRepo = ds.getRepository(ItsmMajorIncidentUpdate);
  const miLinkRepo = ds.getRepository(ItsmMajorIncidentLink);
  const prbRepo = ds.getRepository(ItsmProblem);
  const prbIncRepo = ds.getRepository(ItsmProblemIncident);
  const prbChgRepo = ds.getRepository(ItsmProblemChange);
  const keRepo = ds.getRepository(ItsmKnownError);
  const riskRepo = ds.getRepository(GrcRisk);
  const riskCtrlRepo = ds.getRepository(GrcRiskControl);
  const issueRepo = ds.getRepository(GrcIssue);
  const capaRepo = ds.getRepository(GrcCapa);
  const capaTaskRepo = ds.getRepository(GrcCapaTask);

  const tech1 = techIds[0];
  const group = ASSIGNMENT_GROUPS[0]; // SRE - Core Platform

  // Service for scenario 1
  let svc = await svcRepo.findOne({
    where: { tenantId: DEMO_TENANT_ID, id: SC1.SVC_ID, isDeleted: false },
  });
  if (!svc) {
    svc = svcRepo.create({
      id: SC1.SVC_ID,
      tenantId: DEMO_TENANT_ID,
      name: 'DEMO-Core-Platform-API',
      description: 'Core platform API service (demo scenario 1)',
      type: 'business_service',
      status: 'live',
      tier: 'tier_1',
      criticality: 'high',
      ownerUserId: DEMO_ADMIN_ID,
      createdBy: DEMO_ADMIN_ID,
      isDeleted: false,
    });
    await svcRepo.save(svc);
    stats.created++;
  }

  // Template for DB/config changes
  let tpl = await tplRepo.findOne({
    where: { tenantId: DEMO_TENANT_ID, id: SC1.TPL_ID, isDeleted: false },
  });
  if (!tpl) {
    tpl = tplRepo.create({
      id: SC1.TPL_ID,
      tenantId: DEMO_TENANT_ID,
      name: 'Database / connection pool configuration change',
      code: 'DEMO-SC1-TPL',
      description:
        'Standard change template for DB pool and configuration updates. Includes pre-checks, implementation, and validation.',
      isActive: true,
      isGlobal: false,
      version: 1,
      createdBy: DEMO_ADMIN_ID,
      isDeleted: false,
    });
    await tplRepo.save(tpl);
    stats.created++;
  }

  const taskKeys = ['pre-check', 'implement', 'validate'];
  for (let i = 0; i < taskKeys.length; i++) {
    const key = taskKeys[i];
    const existing = await tplTaskRepo.findOne({
      where: { tenantId: DEMO_TENANT_ID, templateId: tpl.id, taskKey: key, isDeleted: false },
    });
    if (!existing) {
      const tt = tplTaskRepo.create({
        tenantId: DEMO_TENANT_ID,
        templateId: tpl.id,
        taskKey: key,
        title: key === 'pre-check' ? 'Pre-change backup and health check' : key === 'implement' ? 'Apply configuration change' : 'Post-change validation',
        taskType: key === 'implement' ? ChangeTaskType.IMPLEMENTATION : ChangeTaskType.VALIDATION,
        defaultStatus: ChangeTaskStatus.OPEN,
        sequenceOrder: i + 1,
        sortOrder: i,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      await tplTaskRepo.save(tt);
      stats.created++;
    }
  }

  // Change: DB pool config (REVIEW)
  let chg = await changeRepo.findOne({
    where: { tenantId: DEMO_TENANT_ID, id: SC1.CHG_ID, isDeleted: false },
  });
  if (!chg) {
    chg = changeRepo.create({
      id: SC1.CHG_ID,
      tenantId: DEMO_TENANT_ID,
      number: 'DEMO-SC1-CHG-001',
      title: 'Increase database connection pool limits and tune timeouts',
      description:
        'Change to raise max pool size from 50 to 100 and increase connection timeout from 5s to 10s ' +
        'to reduce connection exhaustion during peak. Implemented in non-prod; this change applies to production.',
      type: ChangeType.NORMAL,
      state: ChangeState.REVIEW,
      risk: ChangeRisk.MEDIUM,
      approvalStatus: ChangeApprovalStatus.APPROVED,
      requesterId: tech1,
      assigneeId: tech1,
      serviceId: SC1.SVC_ID,
      plannedStartAt: hoursAgo(48),
      plannedEndAt: hoursAgo(47),
      actualStartAt: hoursAgo(47),
      actualEndAt: hoursAgo(46),
      customerCompanyId: companyId,
      implementationPlan: '1. Backup config 2. Update pool params 3. Restart app tier 4. Smoke test',
      backoutPlan: 'Revert config and restart.',
      justification: 'Address repeated pool exhaustion incidents during peak traffic.',
      createdBy: DEMO_ADMIN_ID,
      isDeleted: false,
    });
    await changeRepo.save(chg);
    stats.created++;
  }

  // 3 Incidents
  const incData = [
    {
      id: SC1.INC1_ID,
      number: 'DEMO-SC1-INC-001',
      short: 'Application timeouts and connection errors during peak',
      desc: 'Users reported timeouts and "connection refused" errors between 14:00–15:30. Metrics showed pool saturation at 100%.',
      priority: IncidentPriority.P2,
      status: IncidentStatus.RESOLVED,
      resolvedAt: hoursAgo(36),
    },
    {
      id: SC1.INC2_ID,
      number: 'DEMO-SC1-INC-002',
      short: 'Core Platform API returning 503 under load',
      desc: 'API health checks failed; pool exhaustion caused 503. Correlated with DEMO-SC1-INC-001.',
      priority: IncidentPriority.P1,
      status: IncidentStatus.RESOLVED,
      resolvedAt: hoursAgo(35),
    },
    {
      id: SC1.INC3_ID,
      number: 'DEMO-SC1-INC-003',
      short: 'Intermittent DB connection timeouts in Core Platform',
      desc: 'Intermittent timeouts; root cause investigation led to connection pool exhaustion.',
      priority: IncidentPriority.P2,
      status: IncidentStatus.CLOSED,
      resolvedAt: hoursAgo(34),
    },
  ];

  for (const inc of incData) {
    let existing = await incRepo.findOne({
      where: { tenantId: DEMO_TENANT_ID, id: inc.id, isDeleted: false },
    });
    if (!existing) {
      existing = incRepo.create({
        id: inc.id,
        tenantId: DEMO_TENANT_ID,
        number: inc.number,
        shortDescription: inc.short,
        description: inc.desc,
        category: IncidentCategory.SOFTWARE,
        impact: IncidentImpact.HIGH,
        urgency: IncidentUrgency.HIGH,
        priority: inc.priority,
        status: inc.status,
        source: IncidentSource.MONITORING,
        assignmentGroup: group,
        assignedTo: tech1,
        serviceId: SC1.SVC_ID,
        customerCompanyId: companyId,
        firstResponseAt: hoursAgo(38),
        resolvedAt: inc.resolvedAt,
        resolutionNotes: 'Workaround: restarted app tier to clear pool; permanent fix via change DEMO-SC1-CHG-001 and known error.',
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      await incRepo.save(existing);
      stats.created++;
    }
  }

  // Major Incident
  let mi = await miRepo.findOne({
    where: { tenantId: DEMO_TENANT_ID, id: SC1.MI_ID, isDeleted: false },
  });
  if (!mi) {
    mi = miRepo.create({
      id: SC1.MI_ID,
      tenantId: DEMO_TENANT_ID,
      number: 'DEMO-SC1-MI-001',
      title: 'Core Platform API widespread outage due to connection pool exhaustion',
      description:
        'Major incident declared due to widespread impact across Core Platform API. ' +
        'Root cause: DB connection pool exhaustion during peak. Multiple incidents linked.',
      status: MajorIncidentStatus.RESOLVED,
      severity: MajorIncidentSeverity.SEV2,
      commanderId: tech1,
      techLeadId: tech1,
      primaryServiceId: SC1.SVC_ID,
      declaredAt: hoursAgo(37),
      resolvedAt: hoursAgo(35),
      sourceIncidentId: SC1.INC2_ID,
      customerImpactSummary: 'Core Platform API unavailable for ~90 minutes; dependent apps affected.',
      businessImpactSummary: 'SLA breach; P1 incidents raised. Follow-up: Problem and Known Error created.',
      resolutionSummary: 'Pool limits increased via emergency change; workaround documented in Known Error.',
      createdBy: DEMO_ADMIN_ID,
      isDeleted: false,
    });
    await miRepo.save(mi);
    stats.created++;
  }

  const miUpdates = [
    { message: 'MI declared. Impact: Core Platform API returning 503. Assigning SRE - Core Platform.', type: MajorIncidentUpdateType.STATUS_CHANGE, vis: MajorIncidentUpdateVisibility.INTERNAL },
    { message: 'Stakeholder comms draft: We are investigating a major incident affecting Core Platform API. ETA for next update 30 min.', type: MajorIncidentUpdateType.COMMUNICATION, vis: MajorIncidentUpdateVisibility.EXTERNAL },
    { message: 'Root cause identified: DB connection pool exhaustion. Implementing workaround (restart + pool config change).', type: MajorIncidentUpdateType.TECHNICAL_UPDATE, vis: MajorIncidentUpdateVisibility.INTERNAL },
    { message: 'Service restored. Post-incident review and Problem/KE creation in progress.', type: MajorIncidentUpdateType.STATUS_CHANGE, vis: MajorIncidentUpdateVisibility.EXTERNAL },
  ];
  for (const u of miUpdates) {
    const exists = await miUpdateRepo.findOne({
      where: { tenantId: DEMO_TENANT_ID, majorIncidentId: SC1.MI_ID, message: u.message },
    });
    if (!exists) {
      const upd = miUpdateRepo.create({
        tenantId: DEMO_TENANT_ID,
        majorIncidentId: SC1.MI_ID,
        message: u.message,
        updateType: u.type,
        visibility: u.vis,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      await miUpdateRepo.save(upd);
      stats.created++;
    }
  }

  for (const incId of [SC1.INC1_ID, SC1.INC2_ID, SC1.INC3_ID]) {
    const linkExists = await miLinkRepo.findOne({
      where: { tenantId: DEMO_TENANT_ID, majorIncidentId: SC1.MI_ID, linkType: MajorIncidentLinkType.INCIDENT, linkedRecordId: incId },
    });
    if (!linkExists) {
      const link = miLinkRepo.create({
        tenantId: DEMO_TENANT_ID,
        majorIncidentId: SC1.MI_ID,
        linkType: MajorIncidentLinkType.INCIDENT,
        linkedRecordId: incId,
        linkedRecordLabel: incId === SC1.INC1_ID ? 'DEMO-SC1-INC-001' : incId === SC1.INC2_ID ? 'DEMO-SC1-INC-002' : 'DEMO-SC1-INC-003',
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      await miLinkRepo.save(link);
      stats.created++;
    }
  }

  // Problem
  let prb = await prbRepo.findOne({
    where: { tenantId: DEMO_TENANT_ID, id: SC1.PRB_ID, isDeleted: false },
  });
  if (!prb) {
    prb = prbRepo.create({
      id: SC1.PRB_ID,
      tenantId: DEMO_TENANT_ID,
      number: 'DEMO-SC1-PRB-001',
      shortDescription: 'Database connection pool exhaustion during peak hours',
      description:
        'Recurring pool exhaustion during peak leading to timeouts and 503. ' +
        'Root cause: pool size and timeout settings insufficient for observed load; no saturation alerting.',
      category: ProblemCategory.SOFTWARE,
      state: ProblemState.KNOWN_ERROR,
      priority: ProblemPriority.P2,
      impact: ProblemImpact.HIGH,
      urgency: ProblemUrgency.HIGH,
      source: ProblemSource.INCIDENT,
      symptomSummary: '503s, timeouts, connection errors during peak.',
      workaroundSummary: 'Restart app tier to clear pool; reduce load if possible.',
      rootCauseSummary: 'Insufficient pool capacity and missing saturation alerting; config change (DEMO-SC1-CHG-001) and runbook update in progress.',
      knownError: true,
      assignmentGroup: group,
      assignedTo: tech1,
      serviceId: SC1.SVC_ID,
      detectedAt: hoursAgo(38),
      openedAt: hoursAgo(37),
      resolvedAt: hoursAgo(35),
      fiveWhySummary: 'Why 503? Pool full. Why full? Peak load exceeded capacity. Why? Limits not tuned. Why? No alerting. Why? Runbook gap.',
      rootCauseCategory: RootCauseCategory.CAPACITY_ISSUE,
      contributingFactors: ['Peak load higher than design', 'No pool saturation alert', 'Default pool size too low'],
      rcaCompletedAt: hoursAgo(35),
      rcaCompletedBy: tech1,
      createdBy: DEMO_ADMIN_ID,
      isDeleted: false,
    });
    await prbRepo.save(prb);
    stats.created++;
  }

  for (const incId of [SC1.INC1_ID, SC1.INC2_ID, SC1.INC3_ID]) {
    const exists = await prbIncRepo.findOne({
      where: { tenantId: DEMO_TENANT_ID, problemId: SC1.PRB_ID, incidentId: incId },
    });
    if (!exists) {
      const link = prbIncRepo.create({
        tenantId: DEMO_TENANT_ID,
        problemId: SC1.PRB_ID,
        incidentId: incId,
        linkType: ProblemIncidentLinkType.RELATED,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      await prbIncRepo.save(link);
      stats.created++;
    }
  }

  const prbChgExists = await prbChgRepo.findOne({
    where: { tenantId: DEMO_TENANT_ID, problemId: SC1.PRB_ID, changeId: SC1.CHG_ID },
  });
  if (!prbChgExists) {
    const link = prbChgRepo.create({
      tenantId: DEMO_TENANT_ID,
      problemId: SC1.PRB_ID,
      changeId: SC1.CHG_ID,
      relationType: ProblemChangeLinkType.PERMANENT_FIX,
      createdBy: DEMO_ADMIN_ID,
      isDeleted: false,
    });
    await prbChgRepo.save(link);
    stats.created++;
  }

  // Known Error
  let ke = await keRepo.findOne({
    where: { tenantId: DEMO_TENANT_ID, id: SC1.KE_ID, isDeleted: false },
  });
  if (!ke) {
    ke = keRepo.create({
      id: SC1.KE_ID,
      tenantId: DEMO_TENANT_ID,
      title: 'Database connection pool exhaustion during peak — workaround',
      symptoms: 'Application timeouts, 503, connection refused; pool saturation at 100%.',
      rootCause: 'DB connection pool size and timeout settings insufficient for peak load; no saturation alerting.',
      workaround:
        '1. Restart the application tier to clear stuck connections and reset pool. ' +
        '2. If possible, temporarily reduce load (e.g. defer non-critical jobs). ' +
        '3. Monitor pool metrics; if saturation recurs before permanent fix, repeat restart and escalate to SRE. ' +
        '4. Permanent fix: apply change DEMO-SC1-CHG-001 (pool limits and timeouts) and add pool saturation alert (CAPA DEMO-SC1-CAPA).',
      permanentFixStatus: KnownErrorFixStatus.FIX_IN_PROGRESS,
      state: KnownErrorState.PUBLISHED,
      problemId: SC1.PRB_ID,
      publishedAt: hoursAgo(34),
      validatedAt: hoursAgo(34),
      validatedBy: tech1,
      createdBy: DEMO_ADMIN_ID,
      isDeleted: false,
    });
    await keRepo.save(ke);
    stats.created++;
  }

  // Risk: Service instability due to insufficient capacity guardrails
  const ctrlForRisk = controls.find((c) => c.code === 'CTL-005') || controls[0];
  let risk = await riskRepo.findOne({
    where: { tenantId: DEMO_TENANT_ID, id: SC1.RISK_ID, isDeleted: false },
  });
  if (!risk) {
    risk = riskRepo.create({
      id: SC1.RISK_ID,
      tenantId: DEMO_TENANT_ID,
      code: 'DEMO-SC1-RISK-001',
      title: 'Service instability due to insufficient capacity guardrails',
      description:
        'Risk of repeated outages from capacity/configuration limits (e.g. connection pool) without alerting or guardrails. ' +
        'Demonstrated by DEMO-SC1 pool exhaustion incident; treatment via CAPA (alerting, tuning, runbook).',
      category: 'Operational',
      severity: RiskSeverity.HIGH,
      likelihood: RiskLikelihood.POSSIBLE,
      impact: RiskSeverity.HIGH,
      inherentScore: 48,
      residualScore: 20,
      riskAppetite: RiskAppetite.MEDIUM,
      treatmentStrategy: TreatmentStrategy.MITIGATE,
      treatmentPlan: 'Add pool saturation alerting, tune limits, load test, update runbook. CAPA DEMO-SC1-CAPA tracks tasks.',
      status: RiskStatus.MITIGATING,
      ownerUserId: tech1,
      dueDate: daysAgo(-30),
      createdBy: DEMO_ADMIN_ID,
      isDeleted: false,
    });
    await riskRepo.save(risk);
    stats.created++;
  }

  const rcExists = await riskCtrlRepo.findOne({
    where: { tenantId: DEMO_TENANT_ID, riskId: SC1.RISK_ID, controlId: ctrlForRisk.id },
  });
  if (!rcExists) {
    const rc = riskCtrlRepo.create({
      tenantId: DEMO_TENANT_ID,
      riskId: SC1.RISK_ID,
      controlId: ctrlForRisk.id,
      createdBy: DEMO_ADMIN_ID,
    });
    await riskCtrlRepo.save(rc);
    stats.created++;
  }

  // Issue + CAPA (one overdue task)
  let issue = await issueRepo.findOne({
    where: { tenantId: DEMO_TENANT_ID, code: 'DEMO-SC1-ISS-001', isDeleted: false },
  });
  if (!issue) {
    issue = issueRepo.create({
      tenantId: DEMO_TENANT_ID,
      code: 'DEMO-SC1-ISS-001',
      title: 'Missing pool saturation alert and capacity guardrails',
      description: 'Connection pool saturation was not alerted; led to DEMO-SC1 incident. Control CTL-005 (Incident Response) requires proactive monitoring.',
      type: IssueType.INTERNAL_AUDIT,
      status: IssueStatus.OPEN,
      severity: IssueSeverity.HIGH,
      controlId: ctrlForRisk.id,
      ownerUserId: tech1,
      createdBy: DEMO_ADMIN_ID,
      isDeleted: false,
    });
    await issueRepo.save(issue);
    stats.created++;
  }

  let capa = await capaRepo.findOne({
    where: { tenantId: DEMO_TENANT_ID, id: SC1.CAPA_ID, isDeleted: false },
  });
  if (!capa) {
    capa = capaRepo.create({
      id: SC1.CAPA_ID,
      tenantId: DEMO_TENANT_ID,
      issueId: issue.id,
      title: 'Add pool saturation alert, tune limits, load test, update runbook',
      description: 'Corrective action from pool exhaustion: 1) Add pool saturation alert 2) Tune limits 3) Load test 4) Update runbook.',
      type: CapaType.CORRECTIVE,
      status: CapaStatus.IN_PROGRESS,
      priority: CAPAPriority.HIGH,
      ownerUserId: tech1,
      dueDate: daysAgo(-14),
      createdBy: DEMO_ADMIN_ID,
      isDeleted: false,
    });
    await capaRepo.save(capa);
    stats.created++;
  }

  const capaTasks = [
    { key: 'alert', title: 'Add pool saturation alert', dueOffset: -5, status: CAPATaskStatus.COMPLETED },
    { key: 'tune', title: 'Tune pool limits and timeouts', dueOffset: -3, status: CAPATaskStatus.IN_PROGRESS },
    { key: 'loadtest', title: 'Load test and update runbook', dueOffset: -3, status: CAPATaskStatus.PENDING }, // overdue: due in past
  ];
  for (let i = 0; i < capaTasks.length; i++) {
    const t = capaTasks[i];
    const due = new Date();
    due.setDate(due.getDate() + t.dueOffset);
    const existing = await capaTaskRepo.findOne({
      where: { tenantId: DEMO_TENANT_ID, capaId: SC1.CAPA_ID, title: t.title },
    });
    if (!existing) {
      const task = capaTaskRepo.create({
        tenantId: DEMO_TENANT_ID,
        capaId: SC1.CAPA_ID,
        title: t.title,
        description: t.key === 'alert' ? 'Configure alert when pool usage > 85%.' : t.key === 'tune' ? 'Apply tuned limits (change DEMO-SC1-CHG-001).' : 'Run load test and document runbook.',
        status: t.status,
        assigneeUserId: tech1,
        dueDate: due,
        completedAt: t.status === CAPATaskStatus.COMPLETED ? hoursAgo(24) : null,
        sequenceOrder: i + 1,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      await capaTaskRepo.save(task);
      stats.created++;
    }
  }
}

// ============================================================================
// SCENARIO 2 — Emergency security patch during freeze window
// ============================================================================

async function seedScenario2(
  ds: DataSource,
  companyId: string,
  techIds: string[],
  controls: GrcControl[],
  requirements: GrcRequirement[],
  stats: { created: number; reused: number },
) {
  const changeRepo = ds.getRepository(ItsmChange);
  const incRepo = ds.getRepository(ItsmIncident);
  const auditRepo = ds.getRepository(GrcAudit);
  const auditReqRepo = ds.getRepository(GrcAuditRequirement);
  const riskRepo = ds.getRepository(GrcRisk);
  const riskCtrlRepo = ds.getRepository(GrcRiskControl);
  const evidenceRepo = ds.getRepository(GrcEvidence);

  const tech2 = techIds[1] || techIds[0];
  const vulnControl = controls.find((c) => c.code === 'CTL-006') || controls[0]; // Vulnerability Management
  const reqForAudit = requirements[0];

  // Emergency Change
  let chg = await changeRepo.findOne({
    where: { tenantId: DEMO_TENANT_ID, id: SC2.CHG_ID, isDeleted: false },
  });
  if (!chg) {
    chg = changeRepo.create({
      id: SC2.CHG_ID,
      tenantId: DEMO_TENANT_ID,
      number: 'DEMO-SC2-CHG-001',
      title: 'Emergency security patch for critical CVE in production',
      description:
        'Emergency change to apply vendor patch for critical CVE under active exploitation. ' +
        'Executed during change freeze with CAB approval. Motivated by incident DEMO-SC2-INC-001.',
      type: ChangeType.EMERGENCY,
      state: ChangeState.CLOSED,
      risk: ChangeRisk.HIGH,
      approvalStatus: ChangeApprovalStatus.APPROVED,
      requesterId: tech2,
      assigneeId: tech2,
      plannedStartAt: hoursAgo(72),
      plannedEndAt: hoursAgo(71),
      actualStartAt: hoursAgo(71),
      actualEndAt: hoursAgo(70),
      customerCompanyId: companyId,
      justification: 'Active exploitation attempt detected (DEMO-SC2-INC-001). Delay would exceed security policy.',
      metadata: { scenario: 'scenario2', motivatedByIncidentId: SC2.INC_ID, freezeWindowOverride: true },
      createdBy: DEMO_ADMIN_ID,
      isDeleted: false,
    });
    await changeRepo.save(chg);
    stats.created++;
  }

  // Incident that motivated the change
  let inc = await incRepo.findOne({
    where: { tenantId: DEMO_TENANT_ID, id: SC2.INC_ID, isDeleted: false },
  });
  if (!inc) {
    inc = incRepo.create({
      id: SC2.INC_ID,
      tenantId: DEMO_TENANT_ID,
      number: 'DEMO-SC2-INC-001',
      shortDescription: 'Active exploitation attempt detected on production system',
      description:
        'Security monitoring detected attempted exploitation of a known critical CVE on a production asset. ' +
        'Emergency change DEMO-SC2-CHG-001 raised to deploy vendor patch. Control CTL-006 (Vulnerability Management) requires evidence of patch deployment.',
      category: IncidentCategory.SOFTWARE,
      impact: IncidentImpact.HIGH,
      urgency: IncidentUrgency.HIGH,
      priority: IncidentPriority.P1,
      status: IncidentStatus.CLOSED,
      source: IncidentSource.MONITORING,
      assignmentGroup: ASSIGNMENT_GROUPS[2],
      assignedTo: tech2,
      customerCompanyId: companyId,
      firstResponseAt: hoursAgo(74),
      resolvedAt: hoursAgo(70),
      resolutionNotes: 'Patch applied via DEMO-SC2-CHG-001. Evidence to be attached to control for audit.',
      createdBy: DEMO_ADMIN_ID,
      isDeleted: false,
    });
    await incRepo.save(inc);
    stats.created++;
  }

  // Control evidence gap: create draft evidence (not linked to control) so "Evidence expected / missing" can be shown for CTL-006
  const name = 'DEMO-SC2 — Patch evidence (expected, not yet approved)';
  let draftEvidence = await evidenceRepo.findOne({
    where: { tenantId: DEMO_TENANT_ID, name, isDeleted: false },
  });
  if (!draftEvidence) {
    draftEvidence = evidenceRepo.create({
      tenantId: DEMO_TENANT_ID,
      name,
      description: 'Evidence expected for CTL-006 after emergency patch. Upload and approve to clear alert.',
      type: 'DOCUMENT' as never,
      sourceType: 'MANUAL' as never,
      status: EvidenceStatus.DRAFT,
      location: '/evidence/demo-sc2-patch-evidence.pdf',
      collectedAt: daysAgo(60),
      collectedByUserId: DEMO_ADMIN_ID,
      createdBy: DEMO_ADMIN_ID,
      isDeleted: false,
    });
    await evidenceRepo.save(draftEvidence);
    stats.created++;
  }

  // Audit touchpoint
  let audit = await auditRepo.findOne({
    where: { tenantId: DEMO_TENANT_ID, id: SC2.AUDIT_ID, isDeleted: false },
  });
  if (!audit) {
    audit = auditRepo.create({
      id: SC2.AUDIT_ID,
      tenantId: DEMO_TENANT_ID,
      code: 'DEMO-SC2-AUD-001',
      name: 'Q1 Security controls and emergency change review',
      description: 'Mini audit scope touching vulnerability management and emergency change controls.',
      auditType: AuditType.INTERNAL,
      status: AuditStatus.IN_PROGRESS,
      riskLevel: AuditRiskLevel.HIGH,
      ownerUserId: tech2,
      leadAuditorId: tech2,
      plannedStartDate: daysAgo(10),
      plannedEndDate: daysAgo(5),
      scope: 'Vulnerability management (CTL-006), incident response, and emergency change evidence.',
      createdBy: DEMO_ADMIN_ID,
      isDeleted: false,
    });
    await auditRepo.save(audit);
    stats.created++;
  }

  if (reqForAudit) {
    const arExists = await auditReqRepo.findOne({
      where: { tenantId: DEMO_TENANT_ID, auditId: SC2.AUDIT_ID, requirementId: reqForAudit.id },
    });
    if (!arExists) {
      const ar = auditReqRepo.create({
        tenantId: DEMO_TENANT_ID,
        auditId: SC2.AUDIT_ID,
        requirementId: reqForAudit.id,
        status: AuditRequirementStatus.IN_SCOPE,
        notes: 'Control CTL-006 (Vulnerability Management) in scope; evidence expected for recent emergency patch.',
      });
      await auditReqRepo.save(ar);
      stats.created++;
    }
  }

  // Risk: likelihood increased, follow-up required
  let risk = await riskRepo.findOne({
    where: { tenantId: DEMO_TENANT_ID, id: SC2.RISK_ID, isDeleted: false },
  });
  if (!risk) {
    risk = riskRepo.create({
      id: SC2.RISK_ID,
      tenantId: DEMO_TENANT_ID,
      code: 'DEMO-SC2-RISK-001',
      title: 'Unpatched critical vulnerability in production',
      description:
        'Risk of exploitation due to delayed patching. Emergency patch (DEMO-SC2-CHG-001) applied; ' +
        'likelihood increased until evidence is documented and control evidence gap closed. Follow-up review required.',
      category: 'Cyber',
      severity: RiskSeverity.HIGH,
      likelihood: RiskLikelihood.LIKELY,
      impact: RiskSeverity.HIGH,
      inherentScore: 56,
      residualScore: 28,
      riskAppetite: RiskAppetite.LOW,
      treatmentStrategy: TreatmentStrategy.MITIGATE,
      treatmentPlan: 'Document patch evidence for CTL-006; complete audit requirement; schedule follow-up risk review.',
      status: RiskStatus.MITIGATING,
      ownerUserId: tech2,
      dueDate: daysAgo(-7),
      createdBy: DEMO_ADMIN_ID,
      isDeleted: false,
    });
    await riskRepo.save(risk);
    stats.created++;
  }

  const rcExists = await riskCtrlRepo.findOne({
    where: { tenantId: DEMO_TENANT_ID, riskId: SC2.RISK_ID, controlId: vulnControl.id },
  });
  if (!rcExists) {
    const rc = riskCtrlRepo.create({
      tenantId: DEMO_TENANT_ID,
      riskId: SC2.RISK_ID,
      controlId: vulnControl.id,
      createdBy: DEMO_ADMIN_ID,
    });
    await riskCtrlRepo.save(rc);
    stats.created++;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function run() {
  const scriptStart = Date.now();
  console.log('\n[SEED-DEMO-PACK] === Demo Seed Pack ===');
  console.log(`[SEED-DEMO-PACK] Start: ${new Date().toISOString()}\n`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);

  const stats = { created: 0, reused: 0 };

  try {
    console.log('1. Tenant, admin, company, users...');
    await ensureDemoTenantAndAdmin(ds);
    const companyId = await ensureDemoCompany(ds);
    const { techIds } = await ensureDemoUsers(ds);

    console.log('2. Resolving existing GRC controls and requirements...');
    const controlRepo = ds.getRepository(GrcControl);
    const requirementRepo = ds.getRepository(GrcRequirement);
    const controls = await controlRepo.find({
      where: { tenantId: DEMO_TENANT_ID, isDeleted: false },
    });
    const requirements = await requirementRepo.find({
      where: { tenantId: DEMO_TENANT_ID, isDeleted: false },
      take: 5,
    });
    if (controls.length === 0) {
      console.error('   No controls found. Run seed:grc first.');
      process.exit(1);
    }
    console.log(`   Controls: ${controls.length}, Requirements: ${requirements.length}`);

    console.log('3. Scenario 1 — Database connection pool exhaustion...');
    await seedScenario1(ds, companyId, techIds, controls, stats);

    console.log('4. Scenario 2 — Emergency security patch during freeze...');
    await seedScenario2(ds, companyId, techIds, controls, requirements, stats);

    // --- Validation output & scenario checklist ---
    console.log('\n========================================');
    console.log('DEMO SEED PACK — VALIDATION OUTPUT');
    console.log('========================================');
    console.log(`Tenant ID: ${DEMO_TENANT_ID}`);
    console.log(`Demo company code: ${DEMO_COMPANY_CODE}`);
    console.log(`Stats: created=${stats.created}, reused=${stats.reused}`);
    console.log('');
    console.log('--- SCENARIO CHECKLIST (use these in UI for demos) ---');
    console.log('');
    console.log('SCENARIO 1: "Database connection pool exhaustion during peak hours"');
    console.log('  Change:        number = DEMO-SC1-CHG-001  (id: ' + SC1.CHG_ID + ')');
    console.log('  Incidents:     DEMO-SC1-INC-001, DEMO-SC1-INC-002, DEMO-SC1-INC-003');
    console.log('  Major Incident: number = DEMO-SC1-MI-001  (id: ' + SC1.MI_ID + ')');
    console.log('  Problem:       number = DEMO-SC1-PRB-001  (id: ' + SC1.PRB_ID + ')');
    console.log('  Known Error:   title contains "pool exhaustion"  (id: ' + SC1.KE_ID + ')');
    console.log('  Risk:          code = DEMO-SC1-RISK-001   (id: ' + SC1.RISK_ID + ')');
    console.log('  Issue:         code = DEMO-SC1-ISS-001');
    console.log('  CAPA:          id = ' + SC1.CAPA_ID + ' (tasks: Add pool saturation alert, Tune limits, Load test — one overdue)');
    console.log('  Service:       DEMO-Core-Platform-API  (id: ' + SC1.SVC_ID + ')');
    console.log('');
    console.log('SCENARIO 2: "Emergency security patch during freeze window"');
    console.log('  Change:        number = DEMO-SC2-CHG-001  (id: ' + SC2.CHG_ID + ')');
    console.log('  Incident:      number = DEMO-SC2-INC-001  (id: ' + SC2.INC_ID + ')');
    console.log('  Audit:         code = DEMO-SC2-AUD-001   (id: ' + SC2.AUDIT_ID + ')');
    console.log('  Risk:          code = DEMO-SC2-RISK-001  (id: ' + SC2.RISK_ID + ')');
    console.log('  Control/evidence: CTL-006 (Vulnerability Management) — evidence expected, draft/expired to show alerts');
    console.log('');
    console.log('========================================\n');

    const durationMs = Date.now() - scriptStart;
    console.log(`[SEED-DEMO-PACK] Duration: ${durationMs}ms`);
  } catch (err) {
    console.error('[SEED-DEMO-PACK] Error:', err);
    throw err;
  } finally {
    await app.close();
    clearTimeout(safetyTimer);
  }
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
