process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { Tenant } from '../tenants/tenant.entity';
import {
  ChangeApprovalStatus,
  ChangeRisk,
  ChangeState,
  ChangeType,
  ItsmChange,
} from '../itsm/change/change.entity';
import {
  RiskAssessment,
  RiskLevel,
} from '../itsm/change/risk/risk-assessment.entity';
import { ItsmMajorIncident } from '../itsm/major-incident/major-incident.entity';
import {
  MajorIncidentSeverity,
  MajorIncidentStatus,
} from '../itsm/major-incident/major-incident.enums';

// ============================================================================
// Constants — deterministic IDs for idempotent upserts
// ============================================================================

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

// Topology demo CI IDs (from seed-topology-demo.ts)
const TOPO_CI_PREFIX = 'bbbb0001-0000-0000-0000-';
const TOPO_CI_IDS = {
  API_GATEWAY: `${TOPO_CI_PREFIX}000000000001`,
  AUTH_SERVICE: `${TOPO_CI_PREFIX}000000000002`,
  USER_DB: `${TOPO_CI_PREFIX}000000000003`,
  CACHE_REDIS: `${TOPO_CI_PREFIX}000000000004`,
  MSG_QUEUE: `${TOPO_CI_PREFIX}000000000005`,
  MONITORING: `${TOPO_CI_PREFIX}000000000006`,
};

// Topology demo Service ID (from seed-topology-demo.ts)
const TOPO_SVC_ID = 'bbbb0002-0000-0000-0000-000000000001';

// Closed-loop demo IDs — unique prefix to avoid collisions
const CL_PREFIX = 'cccc0001-0000-0000-0000-';
const CL_CHANGE_HIGH_BLAST_ID = `${CL_PREFIX}000000000001`;
const CL_ASSESSMENT_HIGH_BLAST_ID = `${CL_PREFIX}000000000002`;
const CL_MI_RCA_ID = `${CL_PREFIX}000000000003`;

// ============================================================================
// Seed data
// ============================================================================

function futureDate(hoursFromNow: number): Date {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
}

async function seedTopologyClosedLoopDemo(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Topology Closed-Loop Orchestration Demo Seed');
  console.log('='.repeat(60));
  console.log('');
  console.log('Dependencies:');
  console.log('  1. seed:grc (base tenant + admin user)');
  console.log('  2. seed:cmdb:baseline (CI classes)');
  console.log(
    '  3. seed:topology:demo (topology CIs + relationships + service)',
  );
  console.log('');

  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);

  try {
    // 1. Verify tenant
    console.log('1. Verifying demo tenant...');
    const tenant = await ds
      .getRepository(Tenant)
      .findOne({ where: { id: DEMO_TENANT_ID } });
    if (!tenant) {
      console.error('   ERROR: Demo tenant not found. Run seed:grc first.');
      process.exit(1);
    }
    console.log(`   Demo tenant: ${tenant.name}`);

    // 2. Verify topology CIs exist (dependency check)
    console.log('');
    console.log('2. Verifying topology demo CIs exist...');
    const ciCount: Array<{ cnt: string }> = await ds.query(
      `SELECT COUNT(*) as cnt FROM cmdb_cis WHERE tenant_id = $1 AND id LIKE $2 AND is_deleted = false`,
      [DEMO_TENANT_ID, `${TOPO_CI_PREFIX}%`],
    );
    const topoCiCount = parseInt(ciCount[0]?.cnt ?? '0', 10);
    if (topoCiCount < 6) {
      console.error(
        `   ERROR: Expected 6 topology demo CIs, found ${topoCiCount}. Run seed:topology:demo first.`,
      );
      process.exit(1);
    }
    console.log(`   Found ${topoCiCount} topology demo CIs`);

    // 3. Seed high blast radius change
    console.log('');
    console.log('3. Seeding high blast radius change (CAB required)...');
    const changeRepo = ds.getRepository(ItsmChange);
    const riskRepo = ds.getRepository(RiskAssessment);

    let change = await changeRepo.findOne({
      where: {
        id: CL_CHANGE_HIGH_BLAST_ID,
        tenantId: DEMO_TENANT_ID,
        isDeleted: false,
      },
    });

    const changeData = {
      number: 'CHG-TOPO-001',
      title: 'Upgrade API Gateway TLS certificates (high blast radius)',
      description:
        'Replace expiring TLS certificates on the API Gateway. ' +
        'This change affects all downstream services through the gateway ' +
        '(Auth Service, User DB, Message Queue, Cache). ' +
        'Topology analysis shows 12+ impacted nodes with critical dependency paths. ' +
        'Fragility signals detected: single point of failure at API Gateway, ' +
        'no redundancy for Auth Service.',
      type: ChangeType.NORMAL,
      state: ChangeState.ASSESS,
      risk: ChangeRisk.HIGH,
      approvalStatus: ChangeApprovalStatus.NOT_REQUESTED,
      requesterId: DEMO_ADMIN_ID,
      assigneeId: DEMO_ADMIN_ID,
      serviceId: TOPO_SVC_ID,
      plannedStartAt: futureDate(24),
      plannedEndAt: futureDate(26),
      implementationPlan:
        '1. Generate new TLS certificates from internal CA\n' +
        '2. Deploy certificates to staging API Gateway\n' +
        '3. Run integration test suite against staging\n' +
        '4. Schedule maintenance window (02:00-04:00 UTC)\n' +
        '5. Deploy certificates to production API Gateway\n' +
        '6. Verify all downstream services reconnect\n' +
        '7. Monitor error rates for 30 minutes\n' +
        '8. Close maintenance window',
      backoutPlan:
        '1. Revert to previous TLS certificates (stored in vault)\n' +
        '2. Restart API Gateway with old certificates\n' +
        '3. Verify downstream service connectivity\n' +
        '4. Notify stakeholders of rollback',
      justification:
        'TLS certificates expire in 14 days. Failure to replace will cause ' +
        'complete authentication platform outage affecting all users.',
      metadata: {
        demo: true,
        topologyDemo: 'closed-loop',
        affectedCiIds: Object.values(TOPO_CI_IDS),
        expectedBlastRadius: 12,
        fragilitySignals: [
          'SPOF at API Gateway',
          'No redundancy for Auth Service',
          'Single database for user data',
        ],
      },
    };

    if (!change) {
      change = changeRepo.create({
        id: CL_CHANGE_HIGH_BLAST_ID,
        tenantId: DEMO_TENANT_ID,
        ...changeData,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
    } else {
      Object.assign(change, {
        ...changeData,
        updatedBy: DEMO_ADMIN_ID,
      });
    }

    await changeRepo.save(change);
    console.log(`   Upserted change: ${change.number} — ${change.title}`);

    // 4. Seed risk assessment for the change
    console.log('');
    console.log('4. Seeding risk assessment (HIGH, score 92)...');

    let assessment = await riskRepo.findOne({
      where: {
        id: CL_ASSESSMENT_HIGH_BLAST_ID,
        tenantId: DEMO_TENANT_ID,
        isDeleted: false,
      },
    });

    const assessmentData = {
      changeId: change.id,
      riskScore: 92,
      riskLevel: RiskLevel.HIGH,
      computedAt: new Date(),
      breakdown: [
        { factor: 'Topology blast radius', score: 35, maxScore: 40 },
        { factor: 'Critical dependency touched', score: 20, maxScore: 20 },
        { factor: 'SPOF risk', score: 15, maxScore: 15 },
        { factor: 'Fragility signals (3)', score: 12, maxScore: 15 },
        { factor: 'Service tier (Tier-1)', score: 10, maxScore: 10 },
      ],
      impactedCiCount: 6,
      impactedServiceCount: 1,
      hasFreezeConflict: false,
      hasSlaRisk: true,
    };

    if (!assessment) {
      assessment = riskRepo.create({
        id: CL_ASSESSMENT_HIGH_BLAST_ID,
        tenantId: DEMO_TENANT_ID,
        ...assessmentData,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
    } else {
      Object.assign(assessment, {
        ...assessmentData,
        updatedBy: DEMO_ADMIN_ID,
      });
    }

    await riskRepo.save(assessment);
    console.log(
      `   Upserted risk assessment: score=${assessment.riskScore}, level=${assessment.riskLevel}`,
    );

    // 5. Seed major incident with RCA hypotheses
    console.log('');
    console.log('5. Seeding major incident for RCA demo...');
    const miRepo = ds.getRepository(ItsmMajorIncident);

    let mi = await miRepo.findOne({
      where: {
        id: CL_MI_RCA_ID,
        tenantId: DEMO_TENANT_ID,
        isDeleted: false,
      },
    });

    const miData = {
      number: 'MI-TOPO-001',
      title: 'Authentication Platform Complete Outage',
      description:
        'Total loss of authentication services affecting all user-facing applications. ' +
        'Users unable to log in or maintain sessions. ' +
        'Root cause suspected to be in the Auth Service → User DB dependency chain. ' +
        'Topology RCA analysis identified 3 hypotheses with high confidence scores.',
      status: MajorIncidentStatus.INVESTIGATING,
      severity: MajorIncidentSeverity.SEV1,
      commanderId: DEMO_ADMIN_ID,
      techLeadId: DEMO_ADMIN_ID,
      communicationsLeadId: null,
      primaryServiceId: TOPO_SVC_ID,
      bridgeUrl: 'https://meet.example.com/mi-topo-001',
      bridgeChannel: '#incident-auth-outage',
      bridgeStartedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      customerImpactSummary:
        'All external users unable to authenticate. ' +
        'Estimated 15,000 users affected. ' +
        'SLA breach imminent (99.9% availability target).',
      businessImpactSummary:
        'Revenue impact: ~$50K/hour. ' +
        'Customer support queue at 200% capacity. ' +
        'Partner API integrations failing.',
      declaredAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      metadata: {
        demo: true,
        topologyDemo: 'closed-loop',
        rcaHypotheses: [
          {
            id: 'hyp-001',
            type: 'DATABASE_FAILURE',
            suspectNodeId: TOPO_CI_IDS.USER_DB,
            suspectNodeLabel: 'TOPO-USER-DB',
            confidence: 0.85,
            evidence: [
              'Connection pool exhaustion detected at 14:32 UTC',
              'Slow query log shows 3 queries exceeding 30s timeout',
              'Disk I/O at 98% utilization on primary DB host',
            ],
            recommendedActions: [
              'Create Problem: Investigate User DB performance degradation',
              'Create Known Error: Connection pool sizing insufficient for peak load',
              'Create PIR Action: Implement read replica for auth queries',
            ],
          },
          {
            id: 'hyp-002',
            type: 'CACHE_FAILURE',
            suspectNodeId: TOPO_CI_IDS.CACHE_REDIS,
            suspectNodeLabel: 'TOPO-CACHE',
            confidence: 0.65,
            evidence: [
              'Redis eviction rate spiked 10x at 14:30 UTC',
              'Session cache miss rate increased from 2% to 45%',
              'Auth Service fallback to DB caused cascade',
            ],
            recommendedActions: [
              'Create Problem: Redis capacity planning review',
              'Create Known Error: Session cache eviction policy too aggressive',
            ],
          },
          {
            id: 'hyp-003',
            type: 'NETWORK_PARTITION',
            suspectNodeId: TOPO_CI_IDS.AUTH_SERVICE,
            suspectNodeLabel: 'TOPO-AUTH-SVC',
            confidence: 0.45,
            evidence: [
              'Intermittent TCP RST between Auth Service and User DB',
              'Network switch firmware update completed 2 hours before incident',
            ],
            recommendedActions: [
              'Create PIR Action: Review network change correlation with incidents',
            ],
          },
        ],
      },
    };

    if (!mi) {
      mi = miRepo.create({
        id: CL_MI_RCA_ID,
        tenantId: DEMO_TENANT_ID,
        ...miData,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
    } else {
      Object.assign(mi, {
        ...miData,
        updatedBy: DEMO_ADMIN_ID,
      });
    }

    await miRepo.save(mi);
    console.log(`   Upserted MI: ${mi.number} — ${mi.title}`);

    // Summary
    console.log('');
    console.log('='.repeat(60));
    console.log('Topology Closed-Loop Demo Seed Complete');
    console.log('='.repeat(60));
    console.log('');
    console.log('Seeded records:');
    console.log(`  Change:     ${change.number} (ID: ${change.id})`);
    console.log(
      `              High blast radius, 6 affected CIs, CAB required`,
    );
    console.log(`  Assessment: Score 92, Level HIGH`);
    console.log(`  MI:         ${mi.number} (ID: ${mi.id})`);
    console.log(`              SEV1, INVESTIGATING, 3 RCA hypotheses`);
    console.log('');
    console.log('Demo scenario:');
    console.log(
      '  1. Open Change CHG-TOPO-001 → see topology decision support',
    );
    console.log('     - High blast radius (12 nodes)');
    console.log('     - Fragility signals (SPOF, no redundancy)');
    console.log('     - Governance: CAB_REQUIRED');
    console.log(
      '     - Suggested task pack (validation, rollback readiness, comms)',
    );
    console.log('  2. Open MI MI-TOPO-001 → see RCA hypotheses');
    console.log(
      '     - 3 hypotheses: DB failure (85%), cache failure (65%), network (45%)',
    );
    console.log('     - Create Problem from DB failure hypothesis');
    console.log('     - Create Known Error from cache hypothesis');
    console.log('     - Create PIR Action from network hypothesis');
    console.log('  3. View traceability chain on both records');
    console.log('');
    console.log('Dependency chain:');
    console.log(
      '  seed:grc → seed:cmdb:baseline → seed:topology:demo → seed:topology:closed-loop',
    );
    console.log('');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void seedTopologyClosedLoopDemo();
