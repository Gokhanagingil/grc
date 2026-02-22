process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { Tenant } from '../tenants/tenant.entity';
import { ItsmProblem } from '../itsm/problem/problem.entity';
import { ItsmKnownError } from '../itsm/known-error/known-error.entity';
import { ItsmMajorIncident } from '../itsm/major-incident/major-incident.entity';
import { ItsmPir } from '../itsm/pir/pir.entity';
import { ItsmPirAction } from '../itsm/pir/pir-action.entity';
import { ItsmKnowledgeCandidate } from '../itsm/pir/knowledge-candidate.entity';

import {
  ProblemState,
  ProblemPriority,
  ProblemImpact,
  ProblemUrgency,
  ProblemCategory,
  ProblemSource,
  KnownErrorState,
  KnownErrorFixStatus,
} from '../itsm/enums';
import {
  MajorIncidentStatus,
  MajorIncidentSeverity,
} from '../itsm/major-incident/major-incident.enums';
import {
  PirStatus,
  PirActionStatus,
  PirActionPriority,
  KnowledgeCandidateStatus,
  KnowledgeCandidateSourceType,
} from '../itsm/pir/pir.enums';

// ============================================================================
// Constants — deterministic IDs for idempotent upserts
// ============================================================================

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

// Problems (5)
const PRB_IDS = [
  'aaaa0001-0000-0000-0000-000000000001',
  'aaaa0001-0000-0000-0000-000000000002',
  'aaaa0001-0000-0000-0000-000000000003',
  'aaaa0001-0000-0000-0000-000000000004',
  'aaaa0001-0000-0000-0000-000000000005',
];

// Known Errors (2)
const KE_IDS = [
  'aaaa0002-0000-0000-0000-000000000001',
  'aaaa0002-0000-0000-0000-000000000002',
];

// Major Incidents (2)
const MI_IDS = [
  'aaaa0003-0000-0000-0000-000000000001',
  'aaaa0003-0000-0000-0000-000000000002',
];

// PIRs (1)
const PIR_IDS = ['aaaa0004-0000-0000-0000-000000000001'];

// PIR Actions (3)
const ACTION_IDS = [
  'aaaa0005-0000-0000-0000-000000000001',
  'aaaa0005-0000-0000-0000-000000000002',
  'aaaa0005-0000-0000-0000-000000000003',
];

// Knowledge Candidates (2)
const KC_IDS = [
  'aaaa0006-0000-0000-0000-000000000001',
  'aaaa0006-0000-0000-0000-000000000002',
];

// ============================================================================
// Date helpers
// ============================================================================

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 0, 0, 0);
  return d;
}

// ============================================================================
// Upsert helper
// ============================================================================

async function upsert<T extends { id: string }>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  repo: any,
  id: string,
  tenantId: string,
  data: Partial<T>,
  label: string,
): Promise<T> {
  let entity = await repo.findOne({ where: { id, tenantId } });
  if (!entity) {
    entity = repo.create({ id, tenantId, ...data, createdBy: DEMO_ADMIN_ID, isDeleted: false });
    await repo.save(entity);
    console.log(`   + Created ${label}`);
  } else {
    Object.assign(entity, data, { updatedBy: DEMO_ADMIN_ID });
    await repo.save(entity);
    console.log(`   = Updated ${label}`);
  }
  return entity;
}

// ============================================================================
// Main
// ============================================================================

async function seedItsmAnalyticsDemo(): Promise<void> {
  console.log('='.repeat(60));
  console.log('ITSM Analytics Demo Seed');
  console.log('='.repeat(60));
  console.log('');

  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);

  try {
    // 1. Verify tenant
    console.log('1. Verifying demo tenant...');
    const tenant = await ds.getRepository(Tenant).findOne({ where: { id: DEMO_TENANT_ID } });
    if (!tenant) {
      console.error('   ERROR: Demo tenant not found. Run seed:grc first.');
      process.exit(1);
    }
    console.log(`   Demo tenant: ${tenant.name}`);

    // 2. Seed Problems (5)
    console.log('');
    console.log('2. Seeding problems (5)...');
    const problemRepo = ds.getRepository(ItsmProblem);

    const problems: Array<{ id: string; number: string; data: Partial<ItsmProblem> }> = [
      {
        id: PRB_IDS[0],
        number: 'PRB800001',
        data: {
          number: 'PRB800001',
          shortDescription: 'Recurring login failures on SSO gateway',
          description: 'Multiple users report intermittent 503 errors during SSO authentication.',
          category: ProblemCategory.SOFTWARE,
          state: ProblemState.UNDER_INVESTIGATION,
          priority: ProblemPriority.P1,
          impact: ProblemImpact.HIGH,
          urgency: ProblemUrgency.HIGH,
          source: ProblemSource.INCIDENT_CLUSTER,
          knownError: false,
          reopenCount: 1,
          assignedTo: DEMO_ADMIN_ID,
          openedAt: daysAgo(45),
          lastReopenedAt: daysAgo(10),
          lastReopenReason: 'Fix reverted due to side effects',
        },
      },
      {
        id: PRB_IDS[1],
        number: 'PRB800002',
        data: {
          number: 'PRB800002',
          shortDescription: 'Database connection pool exhaustion under load',
          description: 'Connection pool hits max during peak hours causing service degradation.',
          category: ProblemCategory.DATABASE,
          state: ProblemState.KNOWN_ERROR,
          priority: ProblemPriority.P2,
          impact: ProblemImpact.HIGH,
          urgency: ProblemUrgency.MEDIUM,
          source: ProblemSource.MONITORING,
          knownError: true,
          reopenCount: 0,
          assignedTo: DEMO_ADMIN_ID,
          openedAt: daysAgo(60),
        },
      },
      {
        id: PRB_IDS[2],
        number: 'PRB800003',
        data: {
          number: 'PRB800003',
          shortDescription: 'Email notification delays exceeding SLA',
          description: 'Outbound email queue backs up during bulk operations.',
          category: ProblemCategory.APPLICATION,
          state: ProblemState.RESOLVED,
          priority: ProblemPriority.P3,
          impact: ProblemImpact.MEDIUM,
          urgency: ProblemUrgency.MEDIUM,
          source: ProblemSource.MANUAL,
          knownError: false,
          reopenCount: 0,
          assignedTo: DEMO_ADMIN_ID,
          openedAt: daysAgo(30),
          resolvedAt: daysAgo(5),
        },
      },
      {
        id: PRB_IDS[3],
        number: 'PRB800004',
        data: {
          number: 'PRB800004',
          shortDescription: 'Network latency spikes in EU region',
          description: 'Intermittent latency spikes affecting EU-based API calls.',
          category: ProblemCategory.NETWORK,
          state: ProblemState.CLOSED,
          priority: ProblemPriority.P2,
          impact: ProblemImpact.MEDIUM,
          urgency: ProblemUrgency.HIGH,
          source: ProblemSource.MONITORING,
          knownError: false,
          reopenCount: 0,
          assignedTo: DEMO_ADMIN_ID,
          openedAt: daysAgo(90),
          resolvedAt: daysAgo(20),
          closedAt: daysAgo(15),
        },
      },
      {
        id: PRB_IDS[4],
        number: 'PRB800005',
        data: {
          number: 'PRB800005',
          shortDescription: 'Disk space alerts on backup server',
          description: 'Backup retention policy not cleaning old snapshots.',
          category: ProblemCategory.INFRASTRUCTURE,
          state: ProblemState.NEW,
          priority: ProblemPriority.P4,
          impact: ProblemImpact.LOW,
          urgency: ProblemUrgency.LOW,
          source: ProblemSource.PROACTIVE,
          knownError: false,
          reopenCount: 0,
          assignedTo: DEMO_ADMIN_ID,
          openedAt: daysAgo(3),
        },
      },
    ];

    for (const p of problems) {
      await upsert<ItsmProblem>(problemRepo, p.id, DEMO_TENANT_ID, p.data, `Problem ${p.number}`);
    }

    // 3. Seed Known Errors (2)
    console.log('');
    console.log('3. Seeding known errors (2)...');
    const keRepo = ds.getRepository(ItsmKnownError);

    const knownErrors: Array<{ id: string; data: Partial<ItsmKnownError> }> = [
      {
        id: KE_IDS[0],
        data: {
          title: 'KE: Connection pool exhaustion under load',
          symptoms: 'Database queries time out during peak traffic.',
          rootCause: 'Default connection pool size (10) insufficient for peak load.',
          workaround: 'Increase pool size to 50 and enable connection recycling.',
          state: KnownErrorState.PUBLISHED,
          permanentFixStatus: KnownErrorFixStatus.WORKAROUND_AVAILABLE,
          problemId: PRB_IDS[1],
          publishedAt: daysAgo(40),
          knowledgeCandidate: true,
        },
      },
      {
        id: KE_IDS[1],
        data: {
          title: 'KE: Email queue throttling during bulk operations',
          symptoms: 'Bulk email sends cause notification delays exceeding SLA.',
          rootCause: 'SMTP rate limiter caps at 100/min, bulk ops generate 500+ emails.',
          workaround: 'Use async queue with rate-limiting and priority tagging.',
          state: KnownErrorState.DRAFT,
          permanentFixStatus: KnownErrorFixStatus.FIX_IN_PROGRESS,
          problemId: PRB_IDS[2],
          knowledgeCandidate: false,
        },
      },
    ];

    for (const ke of knownErrors) {
      await upsert<ItsmKnownError>(keRepo, ke.id, DEMO_TENANT_ID, ke.data, `KE: ${ke.data.title}`);
    }

    // 4. Seed Major Incidents (2)
    console.log('');
    console.log('4. Seeding major incidents (2)...');
    const miRepo = ds.getRepository(ItsmMajorIncident);

    const majorIncidents: Array<{ id: string; number: string; data: Partial<ItsmMajorIncident> }> = [
      {
        id: MI_IDS[0],
        number: 'MI800001',
        data: {
          number: 'MI800001',
          title: 'Complete SSO outage affecting all users',
          description: 'SSO gateway down for 45 minutes, all logins blocked.',
          status: MajorIncidentStatus.CLOSED,
          severity: MajorIncidentSeverity.SEV1,
          commanderId: DEMO_ADMIN_ID,
          declaredAt: daysAgo(40),
          resolvedAt: daysAgo(40),
          closedAt: daysAgo(38),
          bridgeStartedAt: daysAgo(40),
          bridgeEndedAt: new Date(daysAgo(40).getTime() + 2 * 60 * 60 * 1000), // 2h bridge
          customerImpactSummary: 'All users unable to log in for ~45 minutes.',
          resolutionSummary: 'Rolled back SSO config change and verified connectivity.',
        },
      },
      {
        id: MI_IDS[1],
        number: 'MI800002',
        data: {
          number: 'MI800002',
          title: 'EU region API degradation',
          description: 'API response times > 5s for EU customers, 30% error rate.',
          status: MajorIncidentStatus.RESOLVED,
          severity: MajorIncidentSeverity.SEV2,
          commanderId: DEMO_ADMIN_ID,
          declaredAt: daysAgo(20),
          resolvedAt: daysAgo(19),
          bridgeStartedAt: daysAgo(20),
          bridgeEndedAt: new Date(daysAgo(20).getTime() + 3 * 60 * 60 * 1000), // 3h bridge
          customerImpactSummary: 'EU customers experienced slow API responses for ~4 hours.',
          resolutionSummary: 'Rerouted traffic to secondary CDN and applied DNS fix.',
        },
      },
    ];

    for (const mi of majorIncidents) {
      await upsert<ItsmMajorIncident>(miRepo, mi.id, DEMO_TENANT_ID, mi.data, `MI ${mi.number}`);
    }

    // 5. Seed PIR (1)
    console.log('');
    console.log('5. Seeding PIR (1)...');
    const pirRepo = ds.getRepository(ItsmPir);

    await upsert<ItsmPir>(pirRepo, PIR_IDS[0], DEMO_TENANT_ID, {
      majorIncidentId: MI_IDS[0],
      title: 'PIR: SSO Outage Root Cause Analysis',
      status: PirStatus.APPROVED,
      summary: 'Complete SSO outage caused by misconfigured OIDC redirect after maintenance window.',
      whatHappened: 'During a scheduled SSO configuration update, an incorrect OIDC redirect URI was deployed.',
      timelineHighlights: '10:00 - Config deployed\n10:05 - First alerts\n10:15 - MI declared\n10:45 - Rollback completed\n11:00 - All clear',
      rootCauses: 'Configuration change lacked peer review. No canary deployment for auth changes.',
      whatWorkedWell: 'Fast incident detection (<5 min). Bridge assembled within 10 min.',
      whatDidNotWork: 'No automated rollback for auth config. Change review process bypassed.',
      customerImpact: 'All users (est. 2,000) unable to log in for 45 minutes during business hours.',
      detectionEffectiveness: 'Good - monitoring alerts fired within 5 minutes.',
      responseEffectiveness: 'Adequate - 30 min to resolution once bridge formed.',
      preventiveActions: 'Implement canary deploys for auth changes. Add peer review gate.',
      correctiveActions: 'Rollback deployed, OIDC config validated.',
      approvedBy: DEMO_ADMIN_ID,
      approvedAt: daysAgo(35),
      submittedAt: daysAgo(37),
    }, 'PIR: SSO Outage');

    // 6. Seed PIR Actions (3)
    console.log('');
    console.log('6. Seeding PIR actions (3)...');
    const actionRepo = ds.getRepository(ItsmPirAction);

    const actions: Array<{ id: string; data: Partial<ItsmPirAction> }> = [
      {
        id: ACTION_IDS[0],
        data: {
          pirId: PIR_IDS[0],
          title: 'Implement canary deployment for auth config changes',
          description: 'Add canary deployment step to CI/CD pipeline for SSO config updates.',
          ownerId: DEMO_ADMIN_ID,
          status: PirActionStatus.COMPLETED,
          priority: PirActionPriority.HIGH,
          dueDate: daysAgo(20).toISOString().split('T')[0],
          completedAt: daysAgo(22),
          problemId: PRB_IDS[0],
        },
      },
      {
        id: ACTION_IDS[1],
        data: {
          pirId: PIR_IDS[0],
          title: 'Add mandatory peer review gate for auth changes',
          description: 'Require two approvals for any SSO/OIDC configuration modifications.',
          ownerId: DEMO_ADMIN_ID,
          status: PirActionStatus.IN_PROGRESS,
          priority: PirActionPriority.HIGH,
          dueDate: daysAgo(-10).toISOString().split('T')[0], // 10 days in the future
        },
      },
      {
        id: ACTION_IDS[2],
        data: {
          pirId: PIR_IDS[0],
          title: 'Create automated rollback runbook for auth services',
          description: 'Document and automate rollback procedures for all auth service changes.',
          ownerId: DEMO_ADMIN_ID,
          status: PirActionStatus.OVERDUE,
          priority: PirActionPriority.MEDIUM,
          dueDate: daysAgo(5).toISOString().split('T')[0], // past due
        },
      },
    ];

    for (const a of actions) {
      await upsert<ItsmPirAction>(actionRepo, a.id, DEMO_TENANT_ID, a.data, `Action: ${a.data.title}`);
    }

    // 7. Seed Knowledge Candidates (2)
    console.log('');
    console.log('7. Seeding knowledge candidates (2)...');
    const kcRepo = ds.getRepository(ItsmKnowledgeCandidate);

    const candidates: Array<{ id: string; data: Partial<ItsmKnowledgeCandidate> }> = [
      {
        id: KC_IDS[0],
        data: {
          title: 'KB: Database Connection Pool Tuning Guide',
          sourceType: KnowledgeCandidateSourceType.KNOWN_ERROR,
          sourceId: KE_IDS[0],
          status: KnowledgeCandidateStatus.PUBLISHED,
          synopsis: 'Guide for tuning database connection pool parameters under high load.',
          resolution: 'Increase pool size to 50, enable recycling every 300s, add connection health checks.',
          rootCauseSummary: 'Default pool size insufficient for peak traffic patterns.',
          workaround: 'Temporarily increase pool size via env var until permanent config deployed.',
          symptoms: 'Database query timeouts during peak hours, connection refused errors.',
          publishedAt: daysAgo(35),
          reviewedBy: DEMO_ADMIN_ID,
          reviewedAt: daysAgo(36),
        },
      },
      {
        id: KC_IDS[1],
        data: {
          title: 'KB: SSO Outage Prevention and Recovery',
          sourceType: KnowledgeCandidateSourceType.PIR,
          sourceId: PIR_IDS[0],
          status: KnowledgeCandidateStatus.DRAFT,
          synopsis: 'Lessons learned from SSO outage — canary deployment and rollback procedures.',
          resolution: 'Implement canary deploys for auth changes with automated rollback.',
          rootCauseSummary: 'Misconfigured OIDC redirect URI deployed without peer review.',
          workaround: 'Manual rollback via admin console if canary fails.',
          symptoms: 'Users unable to log in, 503 errors on SSO gateway.',
        },
      },
    ];

    for (const kc of candidates) {
      await upsert<ItsmKnowledgeCandidate>(kcRepo, kc.id, DEMO_TENANT_ID, kc.data, `KC: ${kc.data.title}`);
    }

    // Summary
    console.log('');
    console.log('='.repeat(60));
    console.log('Seed Summary');
    console.log('='.repeat(60));
    console.log(`  Problems:             ${problems.length}`);
    console.log(`  Known Errors:         ${knownErrors.length}`);
    console.log(`  Major Incidents:      ${majorIncidents.length}`);
    console.log(`  PIRs:                 1`);
    console.log(`  PIR Actions:          ${actions.length}`);
    console.log(`  Knowledge Candidates: ${candidates.length}`);
    console.log(`  Total entities:       ${problems.length + knownErrors.length + majorIncidents.length + 1 + actions.length + candidates.length}`);
    console.log('');
    console.log('Dashboard should now show non-zero KPIs for all tabs.');
    console.log('='.repeat(60));
  } finally {
    await app.close();
  }
}

seedItsmAnalyticsDemo().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
