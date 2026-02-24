/**
 * Scenario Data Pack — Deterministic, Idempotent Seed
 *
 * Creates a rich, realistic demo/test dataset spanning CMDB + ITSM + topology/risk
 * for validating Topology Intelligence Phase-2 UX/backend.
 *
 * SCENARIO STORY:
 *   "Online Banking Platform" is a critical Tier-1 business service backed by
 *   a web application, a core API, a PostgreSQL database, a Redis cache, and
 *   a network firewall. A planned Normal change (database version upgrade) is
 *   scheduled. Shortly after the change window opens, a Major Incident is
 *   declared — the core API starts returning 500s. Investigation reveals the
 *   DB upgrade introduced a schema incompatibility. A Problem is raised, a
 *   Known Error is documented with a workaround, and multiple child incidents
 *   are linked. Some CIs intentionally lack metadata to exercise confidence
 *   degradation logic.
 *
 * IDEMPOTENCY: Every record is looked up by deterministic ID or unique natural
 * key before insert. Re-runs log CREATED / REUSED / UPDATED per record.
 *
 * DEPENDENCIES: seed:grc (tenant), seed:cmdb:baseline (CI classes + choices)
 *
 * Usage:
 *   DEV:  npx ts-node -r tsconfig-paths/register src/scripts/seed-scenario-pack.ts
 *   PROD: node dist/scripts/seed-scenario-pack.js
 */

/**
 * Scenario Data Pack — Deterministic, Idempotent Seed
 *
 * CI-safe: includes timing instrumentation, explicit exit, and safety timeout.
 *
 * Environment flags:
 *   JOBS_ENABLED=false  - disable background job scheduling (set automatically)
 *   SEED_TIMEOUT_MS     - safety timeout in ms (default: 120000 = 2 min)
 */
process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../app.module';

// ---------------------------------------------------------------------------
// CI Safety: timeout guard to prevent indefinite hangs in CI
// ---------------------------------------------------------------------------
const SEED_TIMEOUT_MS = parseInt(process.env.SEED_TIMEOUT_MS || '120000', 10);
let safetyTimer: ReturnType<typeof setTimeout> | null = null;
if (require.main === module) {
  safetyTimer = setTimeout(() => {
    console.error(
      `[SEED-SCENARIO-PACK] FATAL: Safety timeout reached (${SEED_TIMEOUT_MS}ms). Forcing exit.`,
    );
    process.exit(2);
  }, SEED_TIMEOUT_MS);
  safetyTimer.unref();
}
import { Tenant } from '../tenants/tenant.entity';

// CMDB
import { CmdbCiClass } from '../itsm/cmdb/ci-class/ci-class.entity';
import { CmdbCi } from '../itsm/cmdb/ci/ci.entity';
import { CmdbCiRel } from '../itsm/cmdb/ci-rel/ci-rel.entity';
import { CmdbService } from '../itsm/cmdb/service/cmdb-service.entity';
import { CmdbServiceOffering } from '../itsm/cmdb/service-offering/cmdb-service-offering.entity';
import { CmdbServiceCi } from '../itsm/cmdb/service-ci/cmdb-service-ci.entity';

// ITSM — Change
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

// ITSM — Incident
import { ItsmIncident } from '../itsm/incident/incident.entity';
import { ItsmIncidentCi } from '../itsm/incident/incident-ci.entity';
import {
  IncidentCategory,
  IncidentImpact,
  IncidentUrgency,
  IncidentPriority,
  IncidentStatus,
  IncidentSource,
} from '../itsm/enums';

// ITSM — Major Incident
import { ItsmMajorIncident } from '../itsm/major-incident/major-incident.entity';
import { ItsmMajorIncidentLink } from '../itsm/major-incident/major-incident-link.entity';
import { ItsmMajorIncidentUpdate } from '../itsm/major-incident/major-incident-update.entity';
import {
  MajorIncidentStatus,
  MajorIncidentSeverity,
  MajorIncidentLinkType,
  MajorIncidentUpdateType,
  MajorIncidentUpdateVisibility,
} from '../itsm/major-incident/major-incident.enums';

// ITSM — Problem
import { ItsmProblem } from '../itsm/problem/problem.entity';
import { ItsmProblemIncident } from '../itsm/problem/problem-incident.entity';
import { ItsmProblemChange } from '../itsm/problem/problem-change.entity';
import {
  ProblemState,
  ProblemPriority,
  ProblemImpact,
  ProblemUrgency,
  ProblemCategory,
  ProblemSource,
  ProblemIncidentLinkType,
  ProblemChangeLinkType,
  RcaEntryType,
  ProblemRiskLevel,
  RootCauseCategory,
} from '../itsm/enums';

// ITSM — Known Error
import { ItsmKnownError } from '../itsm/known-error/known-error.entity';
import { KnownErrorState, KnownErrorFixStatus } from '../itsm/enums';

// ============================================================================
// DETERMINISTIC IDS — Unique prefix dddd to avoid collision with other seeds
// ============================================================================

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

// Prefix scheme: dddd0<layer>00-0000-0000-0000-0000000000<seq>
const ID = {
  // Layer 2: CIs
  CI_WEB_APP: 'dddd0200-0000-0000-0000-000000000001',
  CI_CORE_API: 'dddd0200-0000-0000-0000-000000000002',
  CI_PRIMARY_DB: 'dddd0200-0000-0000-0000-000000000003',
  CI_REDIS_CACHE: 'dddd0200-0000-0000-0000-000000000004',
  CI_FIREWALL: 'dddd0200-0000-0000-0000-000000000005',
  CI_APP_SERVER: 'dddd0200-0000-0000-0000-000000000006',
  CI_BACKUP_DB: 'dddd0200-0000-0000-0000-000000000007', // intentionally sparse metadata

  // Layer 4: Service + Offering
  SVC_ONLINE_BANKING: 'dddd0400-0000-0000-0000-000000000001',
  OFFERING_RETAIL: 'dddd0400-0000-0000-0000-000000000010',
  OFFERING_CORPORATE: 'dddd0400-0000-0000-0000-000000000011',

  // Layer 5: Change + Risk Assessment
  CHANGE_DB_UPGRADE: 'dddd0500-0000-0000-0000-000000000001',
  RISK_DB_UPGRADE: 'dddd0500-0000-0000-0000-000000000010',

  // Layer 6: Incidents + Major Incident
  INC_API_500: 'dddd0600-0000-0000-0000-000000000001',
  INC_LOGIN_FAIL: 'dddd0600-0000-0000-0000-000000000002',
  INC_TIMEOUT: 'dddd0600-0000-0000-0000-000000000003',
  MI_BANKING_OUTAGE: 'dddd0600-0000-0000-0000-000000000010',

  // Layer 7: Problem + Known Error
  PROB_SCHEMA_COMPAT: 'dddd0700-0000-0000-0000-000000000001',
  KE_SCHEMA_WORKAROUND: 'dddd0700-0000-0000-0000-000000000010',
};

// ============================================================================
// LOGGING HELPERS
// ============================================================================

type SeedAction = 'CREATED' | 'REUSED' | 'UPDATED';

function logAction(action: SeedAction, entity: string, label: string): void {
  const icon = action === 'CREATED' ? '+' : action === 'REUSED' ? '=' : '~';
  console.log(`   ${icon} ${action} ${entity}: ${label}`);
}

// ============================================================================
// TIMESTAMP HELPERS — deterministic relative to script execution time
// ============================================================================

const NOW = new Date();

function hoursAgo(h: number): Date {
  return new Date(NOW.getTime() - h * 60 * 60 * 1000);
}

// ============================================================================
// GENERIC UPSERT HELPER
// ============================================================================

async function upsertById<T extends { id: string }>(
  repo: Repository<T>,
  id: string,
  data: Partial<T>,
  entityLabel: string,
  entityType: string,
): Promise<{ entity: T; action: SeedAction }> {
  let existing = await repo.findOne({ where: { id } as never });
  let action: SeedAction;

  if (existing) {
    // Check if any field actually changed (simple shallow compare)
    let changed = false;
    for (const key of Object.keys(data)) {
      const existingVal = (existing as Record<string, unknown>)[key];
      const newVal = (data as Record<string, unknown>)[key];
      if (JSON.stringify(existingVal) !== JSON.stringify(newVal)) {
        changed = true;
        break;
      }
    }
    if (changed) {
      Object.assign(existing, data);
      existing = await repo.save(existing);
      action = 'UPDATED';
    } else {
      action = 'REUSED';
    }
  } else {
    existing = repo.create({ id, ...data } as unknown as T);
    existing = await repo.save(existing);
    action = 'CREATED';
  }

  logAction(action, entityType, entityLabel);
  return { entity: existing, action };
}

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function seedScenarioPack(): Promise<void> {
  const scriptStart = Date.now();
  console.log('');
  console.log('='.repeat(70));
  console.log('  SCENARIO DATA PACK — Deterministic Seed');
  console.log('  Story: Online Banking Platform — DB Upgrade Incident');
  console.log('='.repeat(70));
  console.log(`[SEED-SCENARIO-PACK] Start: ${new Date().toISOString()}`);
  console.log('');

  console.log(
    '[SEED-SCENARIO-PACK] Bootstrapping NestJS application context...',
  );
  const bootstrapStart = Date.now();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);
  console.log(
    `[SEED-SCENARIO-PACK] Bootstrap complete (${Date.now() - bootstrapStart}ms)`,
  );

  const stats = { created: 0, reused: 0, updated: 0 };

  function track(action: SeedAction): void {
    if (action === 'CREATED') stats.created++;
    else if (action === 'REUSED') stats.reused++;
    else stats.updated++;
  }

  try {
    // ======================================================================
    // LAYER 0: Verify prerequisites
    // ======================================================================
    console.log('LAYER 0: Verifying prerequisites...');

    const tenant = await ds
      .getRepository(Tenant)
      .findOne({ where: { id: DEMO_TENANT_ID } });
    if (!tenant) {
      console.error('  ERROR: Demo tenant not found. Run seed:grc first.');
      process.exit(1);
    }
    console.log(`  Tenant: ${tenant.name}`);

    // Resolve CI class map
    const classRepo = ds.getRepository(CmdbCiClass);
    const classes = await classRepo.find({
      where: { tenantId: DEMO_TENANT_ID, isDeleted: false },
    });
    const classMap: Record<string, string> = {};
    for (const cls of classes) {
      classMap[cls.name] = cls.id;
    }

    const requiredClasses = [
      'application',
      'database',
      'cloud_service',
      'network_device',
      'server',
    ];
    const missing = requiredClasses.filter((c) => !classMap[c]);
    if (missing.length > 0) {
      console.error(
        `  ERROR: Missing CI classes: ${missing.join(', ')}. Run seed:cmdb:baseline first.`,
      );
      process.exit(1);
    }
    console.log(`  CI classes resolved: ${Object.keys(classMap).length}`);
    console.log('');

    // ======================================================================
    // LAYER 2: CMDB CIs
    // ======================================================================
    console.log('LAYER 2: Seeding CMDB CIs (7)...');
    const ciRepo = ds.getRepository(CmdbCi);

    const ciSeeds: Array<{
      id: string;
      name: string;
      description: string;
      className: string;
      lifecycle: string;
      environment: string;
      ipAddress: string | null;
      dnsName: string | null;
    }> = [
      {
        id: ID.CI_WEB_APP,
        name: 'SCEN-BANKING-WEB',
        description: 'Online Banking web application (React SPA)',
        className: 'application',
        lifecycle: 'active',
        environment: 'production',
        ipAddress: '10.20.1.10',
        dnsName: 'banking-web.prod.internal',
      },
      {
        id: ID.CI_CORE_API,
        name: 'SCEN-BANKING-API',
        description: 'Core Banking API (NestJS microservice)',
        className: 'application',
        lifecycle: 'active',
        environment: 'production',
        ipAddress: '10.20.1.20',
        dnsName: 'banking-api.prod.internal',
      },
      {
        id: ID.CI_PRIMARY_DB,
        name: 'SCEN-BANKING-DB',
        description: 'Primary PostgreSQL 15 database for banking transactions',
        className: 'database',
        lifecycle: 'active',
        environment: 'production',
        ipAddress: '10.20.2.10',
        dnsName: 'banking-db.prod.internal',
      },
      {
        id: ID.CI_REDIS_CACHE,
        name: 'SCEN-BANKING-CACHE',
        description: 'Redis 7 session & rate-limit cache',
        className: 'cloud_service',
        lifecycle: 'active',
        environment: 'production',
        ipAddress: '10.20.3.10',
        dnsName: null, // intentionally missing — exercises partial confidence
      },
      {
        id: ID.CI_FIREWALL,
        name: 'SCEN-BANKING-FW',
        description: 'Edge firewall / WAF for banking traffic',
        className: 'network_device',
        lifecycle: 'active',
        environment: 'production',
        ipAddress: '10.20.0.1',
        dnsName: 'banking-fw.prod.internal',
      },
      {
        id: ID.CI_APP_SERVER,
        name: 'SCEN-BANKING-SRV',
        description: 'Application server hosting banking API containers',
        className: 'server',
        lifecycle: 'active',
        environment: 'production',
        ipAddress: '10.20.1.100',
        dnsName: 'banking-srv.prod.internal',
      },
      {
        id: ID.CI_BACKUP_DB,
        name: 'SCEN-BANKING-DB-BKP',
        description: 'Backup PostgreSQL read replica (async replication)',
        className: 'database',
        lifecycle: 'active',
        environment: 'production',
        ipAddress: null, // intentionally missing — exercises partial confidence
        dnsName: null, // intentionally missing
      },
    ];

    for (const ci of ciSeeds) {
      const { action } = await upsertById(
        ciRepo,
        ci.id,
        {
          tenantId: DEMO_TENANT_ID,
          name: ci.name,
          description: ci.description,
          classId: classMap[ci.className],
          lifecycle: ci.lifecycle,
          environment: ci.environment,
          ipAddress: ci.ipAddress,
          dnsName: ci.dnsName,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        } as Partial<CmdbCi>,
        ci.name,
        'CI',
      );
      track(action);
    }
    console.log('');

    // ======================================================================
    // LAYER 3: CI Relationships
    // ======================================================================
    console.log('LAYER 3: Seeding CI relationships (8)...');
    const relRepo = ds.getRepository(CmdbCiRel);

    const relSeeds: Array<{
      sourceId: string;
      targetId: string;
      type: string;
      label: string;
    }> = [
      // Web app → Core API
      {
        sourceId: ID.CI_WEB_APP,
        targetId: ID.CI_CORE_API,
        type: 'depends_on',
        label: 'WEB → API',
      },
      // Core API → Primary DB
      {
        sourceId: ID.CI_CORE_API,
        targetId: ID.CI_PRIMARY_DB,
        type: 'depends_on',
        label: 'API → DB',
      },
      // Core API → Redis Cache
      {
        sourceId: ID.CI_CORE_API,
        targetId: ID.CI_REDIS_CACHE,
        type: 'depends_on',
        label: 'API → Cache',
      },
      // Firewall → Web App (traffic flows through)
      {
        sourceId: ID.CI_FIREWALL,
        targetId: ID.CI_WEB_APP,
        type: 'connects_to',
        label: 'FW → WEB',
      },
      // Core API runs_on App Server
      {
        sourceId: ID.CI_CORE_API,
        targetId: ID.CI_APP_SERVER,
        type: 'runs_on',
        label: 'API runs_on SRV',
      },
      // Primary DB → Backup DB (replication)
      {
        sourceId: ID.CI_PRIMARY_DB,
        targetId: ID.CI_BACKUP_DB,
        type: 'connects_to',
        label: 'DB → DB-BKP',
      },
      // Web App → Redis (session)
      {
        sourceId: ID.CI_WEB_APP,
        targetId: ID.CI_REDIS_CACHE,
        type: 'depends_on',
        label: 'WEB → Cache',
      },
      // Firewall → Core API
      {
        sourceId: ID.CI_FIREWALL,
        targetId: ID.CI_CORE_API,
        type: 'connects_to',
        label: 'FW → API',
      },
    ];

    for (const rel of relSeeds) {
      const existing = await relRepo.findOne({
        where: {
          tenantId: DEMO_TENANT_ID,
          sourceCiId: rel.sourceId,
          targetCiId: rel.targetId,
          type: rel.type,
          isDeleted: false,
        },
      });
      if (existing) {
        logAction('REUSED', 'CI-Rel', rel.label);
        track('REUSED');
      } else {
        const entity = relRepo.create({
          tenantId: DEMO_TENANT_ID,
          sourceCiId: rel.sourceId,
          targetCiId: rel.targetId,
          type: rel.type,
          isActive: true,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
        await relRepo.save(entity);
        logAction('CREATED', 'CI-Rel', rel.label);
        track('CREATED');
      }
    }
    console.log('');

    // ======================================================================
    // LAYER 4: Service + Offerings + Service-CI links
    // ======================================================================
    console.log('LAYER 4: Seeding Service, Offerings, and Service-CI links...');
    const svcRepo = ds.getRepository(CmdbService);
    const offeringRepo = ds.getRepository(CmdbServiceOffering);
    const svcCiRepo = ds.getRepository(CmdbServiceCi);

    // Service
    const { action: svcAction } = await upsertById(
      svcRepo,
      ID.SVC_ONLINE_BANKING,
      {
        tenantId: DEMO_TENANT_ID,
        name: 'SCEN-Online-Banking-Platform',
        description:
          'Critical Tier-1 business service providing retail and corporate online banking',
        type: 'business_service',
        status: 'active',
        tier: 'tier_1',
        criticality: 'critical',
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      } as Partial<CmdbService>,
      'SCEN-Online-Banking-Platform',
      'Service',
    );
    track(svcAction);

    // Offerings
    const { action: off1Action } = await upsertById(
      offeringRepo,
      ID.OFFERING_RETAIL,
      {
        tenantId: DEMO_TENANT_ID,
        serviceId: ID.SVC_ONLINE_BANKING,
        name: 'SCEN-Retail-Banking-Portal',
        status: 'active',
        supportHours: '24x7',
        isDeleted: false,
      } as Partial<CmdbServiceOffering>,
      'SCEN-Retail-Banking-Portal',
      'Offering',
    );
    track(off1Action);

    const { action: off2Action } = await upsertById(
      offeringRepo,
      ID.OFFERING_CORPORATE,
      {
        tenantId: DEMO_TENANT_ID,
        serviceId: ID.SVC_ONLINE_BANKING,
        name: 'SCEN-Corporate-Banking-API',
        status: 'active',
        supportHours: 'business_hours',
        isDeleted: false,
      } as Partial<CmdbServiceOffering>,
      'SCEN-Corporate-Banking-API',
      'Offering',
    );
    track(off2Action);

    // Service-CI links
    const svcCiLinks: Array<{
      ciId: string;
      relType: string;
      isPrimary: boolean;
      label: string;
    }> = [
      {
        ciId: ID.CI_WEB_APP,
        relType: 'depends_on',
        isPrimary: true,
        label: 'SVC → WEB',
      },
      {
        ciId: ID.CI_CORE_API,
        relType: 'depends_on',
        isPrimary: true,
        label: 'SVC → API',
      },
      {
        ciId: ID.CI_PRIMARY_DB,
        relType: 'hosted_on',
        isPrimary: false,
        label: 'SVC → DB',
      },
      {
        ciId: ID.CI_REDIS_CACHE,
        relType: 'depends_on',
        isPrimary: false,
        label: 'SVC → Cache',
      },
      {
        ciId: ID.CI_FIREWALL,
        relType: 'depends_on',
        isPrimary: false,
        label: 'SVC → FW',
      },
    ];

    for (const link of svcCiLinks) {
      const existing = await svcCiRepo.findOne({
        where: {
          tenantId: DEMO_TENANT_ID,
          serviceId: ID.SVC_ONLINE_BANKING,
          ciId: link.ciId,
          relationshipType: link.relType,
          isDeleted: false,
        },
      });
      if (existing) {
        logAction('REUSED', 'SvcCI', link.label);
        track('REUSED');
      } else {
        const entity = svcCiRepo.create({
          tenantId: DEMO_TENANT_ID,
          serviceId: ID.SVC_ONLINE_BANKING,
          ciId: link.ciId,
          relationshipType: link.relType,
          isPrimary: link.isPrimary,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
        await svcCiRepo.save(entity);
        logAction('CREATED', 'SvcCI', link.label);
        track('CREATED');
      }
    }
    console.log('');

    // ======================================================================
    // LAYER 5: Change + Risk Assessment
    // ======================================================================
    console.log('LAYER 5: Seeding Change + Risk Assessment...');
    const changeRepo = ds.getRepository(ItsmChange);
    const riskRepo = ds.getRepository(RiskAssessment);

    const { action: chgAction } = await upsertById(
      changeRepo,
      ID.CHANGE_DB_UPGRADE,
      {
        tenantId: DEMO_TENANT_ID,
        number: 'CHG-SCEN-001',
        title: 'Upgrade Banking DB from PostgreSQL 15.4 to 15.6',
        description:
          'Planned maintenance: upgrade primary banking PostgreSQL instance from 15.4 to 15.6 ' +
          'to address CVE-2024-XXXX and improve query planner performance. ' +
          'Topology analysis shows 5 directly impacted CIs through the dependency chain ' +
          '(Core API, Web App, Cache, Firewall, App Server). ' +
          'Change window: 02:00-04:00 UTC Saturday.',
        type: ChangeType.NORMAL,
        state: ChangeState.IMPLEMENT,
        risk: ChangeRisk.HIGH,
        approvalStatus: ChangeApprovalStatus.APPROVED,
        requesterId: DEMO_ADMIN_ID,
        assigneeId: DEMO_ADMIN_ID,
        serviceId: ID.SVC_ONLINE_BANKING,
        offeringId: ID.OFFERING_RETAIL,
        plannedStartAt: hoursAgo(6),
        plannedEndAt: hoursAgo(4),
        actualStartAt: hoursAgo(6),
        implementationPlan:
          '1. Enable maintenance mode on banking web app\n' +
          '2. Stop Core API service gracefully\n' +
          '3. Create DB snapshot for rollback\n' +
          '4. Run pg_upgrade from 15.4 to 15.6\n' +
          '5. Run schema migration validation\n' +
          '6. Restart Core API\n' +
          '7. Disable maintenance mode\n' +
          '8. Monitor error rates for 30 minutes',
        backoutPlan:
          '1. Stop Core API\n' +
          '2. Restore DB from snapshot\n' +
          '3. Restart Core API with old binary\n' +
          '4. Verify service health\n' +
          '5. Notify stakeholders of rollback',
        justification:
          'Critical security patch (CVE-2024-XXXX) + performance improvement. ' +
          'Delay beyond 14 days creates compliance risk.',
        metadata: {
          scenario: 'scenario-pack',
          affectedCiIds: [
            ID.CI_PRIMARY_DB,
            ID.CI_CORE_API,
            ID.CI_WEB_APP,
            ID.CI_REDIS_CACHE,
            ID.CI_FIREWALL,
          ],
        },
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      } as Partial<ItsmChange>,
      'CHG-SCEN-001 — DB Upgrade',
      'Change',
    );
    track(chgAction);

    // Risk Assessment
    const { action: riskAction } = await upsertById(
      riskRepo,
      ID.RISK_DB_UPGRADE,
      {
        tenantId: DEMO_TENANT_ID,
        changeId: ID.CHANGE_DB_UPGRADE,
        riskScore: 78,
        riskLevel: RiskLevel.HIGH,
        computedAt: hoursAgo(12),
        breakdown: [
          {
            factor: 'Topology blast radius',
            score: 28,
            maxScore: 40,
          } as never,
          {
            factor: 'Critical dependency touched (Tier-1 DB)',
            score: 18,
            maxScore: 20,
          } as never,
          {
            factor: 'SPOF risk (single primary DB)',
            score: 12,
            maxScore: 15,
          } as never,
          {
            factor: 'Fragility signals (2)',
            score: 10,
            maxScore: 15,
          } as never,
          {
            factor: 'Service tier (Tier-1)',
            score: 10,
            maxScore: 10,
          } as never,
        ],
        impactedCiCount: 5,
        impactedServiceCount: 1,
        hasFreezeConflict: false,
        hasSlaRisk: true,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      } as Partial<RiskAssessment>,
      'Score 78 HIGH — DB Upgrade',
      'RiskAssessment',
    );
    track(riskAction);
    console.log('');

    // ======================================================================
    // LAYER 6: Incidents + Major Incident
    // ======================================================================
    console.log('LAYER 6: Seeding Incidents + Major Incident...');
    const incRepo = ds.getRepository(ItsmIncident);
    const incCiRepo = ds.getRepository(ItsmIncidentCi);
    const miRepo = ds.getRepository(ItsmMajorIncident);
    const miLinkRepo = ds.getRepository(ItsmMajorIncidentLink);
    const miUpdateRepo = ds.getRepository(ItsmMajorIncidentUpdate);

    // Incident 1: API 500 errors
    const { action: inc1Action } = await upsertById(
      incRepo,
      ID.INC_API_500,
      {
        tenantId: DEMO_TENANT_ID,
        number: 'INC-SCEN-001',
        shortDescription: 'Core Banking API returning HTTP 500 errors',
        description:
          'Starting at 02:45 UTC, the Core Banking API began returning 500 Internal Server Error ' +
          'for all /api/v2/transactions endpoints. Error logs show "relation account_ledger_v2 does not exist". ' +
          'This appears related to the ongoing DB upgrade (CHG-SCEN-001).',
        category: IncidentCategory.SOFTWARE,
        impact: IncidentImpact.HIGH,
        urgency: IncidentUrgency.HIGH,
        priority: IncidentPriority.P1,
        status: IncidentStatus.IN_PROGRESS,
        source: IncidentSource.MONITORING,
        assignmentGroup: 'Platform Engineering',
        assignedTo: DEMO_ADMIN_ID,
        serviceId: ID.SVC_ONLINE_BANKING,
        offeringId: ID.OFFERING_RETAIL,
        firstResponseAt: hoursAgo(3),
        metadata: {
          scenario: 'scenario-pack',
          relatedChangeNumber: 'CHG-SCEN-001',
        },
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      } as Partial<ItsmIncident>,
      'INC-SCEN-001 — API 500',
      'Incident',
    );
    track(inc1Action);

    // Incident 2: Login failures (downstream symptom)
    const { action: inc2Action } = await upsertById(
      incRepo,
      ID.INC_LOGIN_FAIL,
      {
        tenantId: DEMO_TENANT_ID,
        number: 'INC-SCEN-002',
        shortDescription: 'Users unable to log in to Online Banking portal',
        description:
          'Multiple user reports of login failures on the Online Banking portal. ' +
          'Auth flow depends on Core API which is returning 500s. ' +
          'Estimated 5,000 users affected since 02:50 UTC.',
        category: IncidentCategory.ACCESS,
        impact: IncidentImpact.HIGH,
        urgency: IncidentUrgency.HIGH,
        priority: IncidentPriority.P1,
        status: IncidentStatus.IN_PROGRESS,
        source: IncidentSource.USER,
        assignmentGroup: 'Service Desk',
        assignedTo: DEMO_ADMIN_ID,
        serviceId: ID.SVC_ONLINE_BANKING,
        offeringId: ID.OFFERING_RETAIL,
        metadata: {
          scenario: 'scenario-pack',
          parentIncident: 'INC-SCEN-001',
        },
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      } as Partial<ItsmIncident>,
      'INC-SCEN-002 — Login Fail',
      'Incident',
    );
    track(inc2Action);

    // Incident 3: Timeout (partial data — no assignee, exercises confidence degradation)
    const { action: inc3Action } = await upsertById(
      incRepo,
      ID.INC_TIMEOUT,
      {
        tenantId: DEMO_TENANT_ID,
        number: 'INC-SCEN-003',
        shortDescription: 'Corporate API clients receiving timeout errors',
        description:
          'B2B partners report timeout errors on corporate banking API. ' +
          'Impact assessment pending. No assignee yet.',
        category: IncidentCategory.NETWORK,
        impact: IncidentImpact.MEDIUM,
        urgency: IncidentUrgency.MEDIUM,
        priority: IncidentPriority.P2,
        status: IncidentStatus.OPEN,
        source: IncidentSource.EMAIL,
        assignmentGroup: null, // intentionally missing
        assignedTo: null, // intentionally missing — exercises degradation
        serviceId: ID.SVC_ONLINE_BANKING,
        offeringId: ID.OFFERING_CORPORATE,
        metadata: {
          scenario: 'scenario-pack',
          partialData: true,
        },
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      } as Partial<ItsmIncident>,
      'INC-SCEN-003 — Timeout',
      'Incident',
    );
    track(inc3Action);

    // Incident-CI links
    const incCiLinks: Array<{
      incidentId: string;
      ciId: string;
      relType: string;
      impactScope: string | null;
      label: string;
    }> = [
      {
        incidentId: ID.INC_API_500,
        ciId: ID.CI_CORE_API,
        relType: 'affected',
        impactScope: 'primary',
        label: 'INC-001 → API',
      },
      {
        incidentId: ID.INC_API_500,
        ciId: ID.CI_PRIMARY_DB,
        relType: 'caused_by',
        impactScope: 'root_cause',
        label: 'INC-001 → DB',
      },
      {
        incidentId: ID.INC_LOGIN_FAIL,
        ciId: ID.CI_WEB_APP,
        relType: 'affected',
        impactScope: 'primary',
        label: 'INC-002 → WEB',
      },
      {
        incidentId: ID.INC_TIMEOUT,
        ciId: ID.CI_CORE_API,
        relType: 'affected',
        impactScope: null, // intentionally missing
        label: 'INC-003 → API',
      },
    ];

    for (const link of incCiLinks) {
      const existing = await incCiRepo.findOne({
        where: {
          tenantId: DEMO_TENANT_ID,
          incidentId: link.incidentId,
          ciId: link.ciId,
          relationshipType: link.relType,
        },
      });
      if (existing) {
        logAction('REUSED', 'IncCI', link.label);
        track('REUSED');
      } else {
        const entity = incCiRepo.create({
          tenantId: DEMO_TENANT_ID,
          incidentId: link.incidentId,
          ciId: link.ciId,
          relationshipType: link.relType,
          impactScope: link.impactScope,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
        await incCiRepo.save(entity);
        logAction('CREATED', 'IncCI', link.label);
        track('CREATED');
      }
    }

    // Major Incident
    const { action: miAction } = await upsertById(
      miRepo,
      ID.MI_BANKING_OUTAGE,
      {
        tenantId: DEMO_TENANT_ID,
        number: 'MI-SCEN-001',
        title: 'Online Banking Platform Complete Outage',
        description:
          'Total loss of online banking services for retail and corporate customers. ' +
          'Root cause traced to DB schema incompatibility introduced by CHG-SCEN-001 (PG 15.6 upgrade). ' +
          'Topology RCA analysis identifies 3 hypotheses with varying confidence.',
        status: MajorIncidentStatus.INVESTIGATING,
        severity: MajorIncidentSeverity.SEV1,
        commanderId: DEMO_ADMIN_ID,
        techLeadId: DEMO_ADMIN_ID,
        communicationsLeadId: null, // intentionally unfilled — exercises partial UI
        primaryServiceId: ID.SVC_ONLINE_BANKING,
        primaryOfferingId: ID.OFFERING_RETAIL,
        bridgeUrl: 'https://meet.example.com/mi-scen-001',
        bridgeChannel: '#incident-banking-outage',
        bridgeStartedAt: hoursAgo(3),
        customerImpactSummary:
          'All retail and corporate banking customers unable to access accounts. ' +
          'Estimated 25,000 active users affected. SLA breach: 99.95% availability target.',
        businessImpactSummary:
          'Revenue impact: ~$120K/hour in transaction fees. ' +
          'Regulatory reporting may be required if outage exceeds 4 hours. ' +
          'Partner API SLAs breached for 3 corporate clients.',
        declaredAt: hoursAgo(3),
        sourceIncidentId: ID.INC_API_500,
        metadata: {
          scenario: 'scenario-pack',
          rcaHypotheses: [
            {
              id: 'hyp-scen-001',
              type: 'SCHEMA_INCOMPATIBILITY',
              suspectNodeId: ID.CI_PRIMARY_DB,
              suspectNodeLabel: 'SCEN-BANKING-DB',
              confidence: 0.92,
              evidence: [
                'Error: "relation account_ledger_v2 does not exist" in API logs',
                'PG 15.6 changelog mentions legacy view compatibility changes',
                'Schema diff shows 3 missing materialized views post-upgrade',
              ],
              degradingFactors: [],
              recommendedActions: [
                'Create Problem: DB schema migration gap investigation',
                'Create Known Error: Missing materialized views after PG upgrade',
                'Immediate: Restore views from pre-upgrade schema dump',
              ],
            },
            {
              id: 'hyp-scen-002',
              type: 'CONNECTION_POOL_EXHAUSTION',
              suspectNodeId: ID.CI_CORE_API,
              suspectNodeLabel: 'SCEN-BANKING-API',
              confidence: 0.58,
              evidence: [
                'Connection pool utilization at 100% since 02:45 UTC',
                'Retry storm from failed queries consuming all connections',
              ],
              degradingFactors: [
                'No connection pool metrics prior to incident (monitoring gap)',
              ],
              recommendedActions: [
                'Create PIR Action: Add connection pool observability',
              ],
            },
            {
              id: 'hyp-scen-003',
              type: 'CACHE_STAMPEDE',
              suspectNodeId: ID.CI_REDIS_CACHE,
              suspectNodeLabel: 'SCEN-BANKING-CACHE',
              confidence: 0.35,
              evidence: [
                'Cache miss rate spike correlates with incident start time',
              ],
              degradingFactors: [
                'No DNS record for cache CI (partial topology data)',
                'No cache hit/miss metrics available pre-incident',
              ],
              recommendedActions: [
                'Create PIR Action: Instrument cache hit/miss metrics',
              ],
            },
          ],
        },
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      } as Partial<ItsmMajorIncident>,
      'MI-SCEN-001 — Banking Outage',
      'MajorIncident',
    );
    track(miAction);

    // Major Incident Links
    const miLinks: Array<{
      linkType: MajorIncidentLinkType;
      linkedRecordId: string;
      linkedRecordLabel: string;
      notes: string | null;
    }> = [
      {
        linkType: MajorIncidentLinkType.INCIDENT,
        linkedRecordId: ID.INC_API_500,
        linkedRecordLabel: 'INC-SCEN-001: Core Banking API 500 errors',
        notes: 'Primary triggering incident',
      },
      {
        linkType: MajorIncidentLinkType.INCIDENT,
        linkedRecordId: ID.INC_LOGIN_FAIL,
        linkedRecordLabel: 'INC-SCEN-002: Users unable to log in',
        notes: 'Downstream symptom incident',
      },
      {
        linkType: MajorIncidentLinkType.INCIDENT,
        linkedRecordId: ID.INC_TIMEOUT,
        linkedRecordLabel: 'INC-SCEN-003: Corporate API timeouts',
        notes: 'Related incident — partial data',
      },
      {
        linkType: MajorIncidentLinkType.CHANGE,
        linkedRecordId: ID.CHANGE_DB_UPGRADE,
        linkedRecordLabel: 'CHG-SCEN-001: DB Upgrade PG 15.4 → 15.6',
        notes: 'Suspected causal change',
      },
      {
        linkType: MajorIncidentLinkType.CMDB_SERVICE,
        linkedRecordId: ID.SVC_ONLINE_BANKING,
        linkedRecordLabel: 'SCEN-Online-Banking-Platform',
        notes: 'Primary affected service',
      },
      {
        linkType: MajorIncidentLinkType.CMDB_CI,
        linkedRecordId: ID.CI_PRIMARY_DB,
        linkedRecordLabel: 'SCEN-BANKING-DB',
        notes: 'Suspected root cause CI',
      },
      {
        linkType: MajorIncidentLinkType.CMDB_CI,
        linkedRecordId: ID.CI_CORE_API,
        linkedRecordLabel: 'SCEN-BANKING-API',
        notes: 'Directly impacted CI',
      },
    ];

    for (const ml of miLinks) {
      // Unique constraint: tenantId + majorIncidentId + linkType + linkedRecordId
      const existing = await miLinkRepo.findOne({
        where: {
          tenantId: DEMO_TENANT_ID,
          majorIncidentId: ID.MI_BANKING_OUTAGE,
          linkType: ml.linkType,
          linkedRecordId: ml.linkedRecordId,
        },
      });
      if (existing) {
        logAction('REUSED', 'MI-Link', ml.linkedRecordLabel);
        track('REUSED');
      } else {
        const entity = miLinkRepo.create({
          tenantId: DEMO_TENANT_ID,
          majorIncidentId: ID.MI_BANKING_OUTAGE,
          linkType: ml.linkType,
          linkedRecordId: ml.linkedRecordId,
          linkedRecordLabel: ml.linkedRecordLabel,
          notes: ml.notes,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
        await miLinkRepo.save(entity);
        logAction('CREATED', 'MI-Link', ml.linkedRecordLabel);
        track('CREATED');
      }
    }

    // Major Incident Timeline Updates (2 entries)
    const miUpdates: Array<{
      message: string;
      updateType: MajorIncidentUpdateType;
      visibility: MajorIncidentUpdateVisibility;
      previousStatus: string | null;
      newStatus: string | null;
    }> = [
      {
        message:
          'Major Incident declared after multiple P1 incidents correlated with DB upgrade change.',
        updateType: MajorIncidentUpdateType.STATUS_CHANGE,
        visibility: MajorIncidentUpdateVisibility.INTERNAL,
        previousStatus: null,
        newStatus: MajorIncidentStatus.DECLARED,
      },
      {
        message:
          'Bridge opened. Initial analysis: Core API returning 500 with missing relation errors. ' +
          'Suspected schema incompatibility from PG 15.6 upgrade. Investigating DB state.',
        updateType: MajorIncidentUpdateType.TECHNICAL_UPDATE,
        visibility: MajorIncidentUpdateVisibility.INTERNAL,
        previousStatus: MajorIncidentStatus.DECLARED,
        newStatus: MajorIncidentStatus.INVESTIGATING,
      },
    ];

    // Check if timeline updates already exist for this MI
    const existingUpdates = await miUpdateRepo.find({
      where: {
        tenantId: DEMO_TENANT_ID,
        majorIncidentId: ID.MI_BANKING_OUTAGE,
      },
    });

    if (existingUpdates.length >= miUpdates.length) {
      logAction('REUSED', 'MI-Updates', `${existingUpdates.length} entries`);
      track('REUSED');
    } else {
      // Only add missing updates
      for (let i = existingUpdates.length; i < miUpdates.length; i++) {
        const upd = miUpdates[i];
        const entity = miUpdateRepo.create({
          tenantId: DEMO_TENANT_ID,
          majorIncidentId: ID.MI_BANKING_OUTAGE,
          message: upd.message,
          updateType: upd.updateType,
          visibility: upd.visibility,
          previousStatus: upd.previousStatus,
          newStatus: upd.newStatus,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
        await miUpdateRepo.save(entity);
        logAction('CREATED', 'MI-Update', upd.updateType);
        track('CREATED');
      }
    }
    console.log('');

    // ======================================================================
    // LAYER 7: Problem + Known Error + Links
    // ======================================================================
    console.log('LAYER 7: Seeding Problem + Known Error + Links...');
    const probRepo = ds.getRepository(ItsmProblem);
    const probIncRepo = ds.getRepository(ItsmProblemIncident);
    const probChgRepo = ds.getRepository(ItsmProblemChange);
    const keRepo = ds.getRepository(ItsmKnownError);

    // Problem
    const { action: probAction } = await upsertById(
      probRepo,
      ID.PROB_SCHEMA_COMPAT,
      {
        tenantId: DEMO_TENANT_ID,
        number: 'PRB-SCEN-001',
        shortDescription:
          'PostgreSQL 15.6 upgrade drops materialized views used by Core API',
        description:
          'The pg_upgrade from 15.4 to 15.6 did not preserve custom materialized views ' +
          '(account_ledger_v2, txn_summary_daily, auth_session_cache). ' +
          'The Core API depends on these views for critical query paths. ' +
          'Root cause: pg_upgrade does not migrate materialized views by default; ' +
          'the upgrade runbook did not include a re-creation step.',
        category: ProblemCategory.DATABASE,
        state: ProblemState.KNOWN_ERROR,
        priority: ProblemPriority.P1,
        impact: ProblemImpact.HIGH,
        urgency: ProblemUrgency.HIGH,
        source: ProblemSource.INCIDENT_CLUSTER,
        symptomSummary:
          'Core API returns 500 with "relation does not exist" for 3 materialized views.',
        workaroundSummary:
          'Manually re-create materialized views from pre-upgrade schema dump, then REFRESH MATERIALIZED VIEW.',
        rootCauseSummary:
          'pg_upgrade (15.4→15.6) does not preserve materialized views. ' +
          'Upgrade runbook missing explicit view recreation step.',
        knownError: true,
        assignmentGroup: 'Database Engineering',
        assignedTo: DEMO_ADMIN_ID,
        serviceId: ID.SVC_ONLINE_BANKING,
        offeringId: ID.OFFERING_RETAIL,
        detectedAt: hoursAgo(3),
        openedAt: hoursAgo(2),
        problemOperationalRiskScore: 85,
        problemOperationalRiskLevel: ProblemRiskLevel.CRITICAL,
        // Phase 2 structured RCA fields
        fiveWhySummary:
          '1. Why did the API fail? → Missing materialized views in DB.\n' +
          '2. Why were views missing? → pg_upgrade does not migrate them.\n' +
          '3. Why was this not caught? → Upgrade runbook lacked view validation step.\n' +
          '4. Why was the runbook incomplete? → Last upgrade (14→15) had no custom views.\n' +
          '5. Why was there no pre-upgrade validation? → No automated schema diff in CI.',
        contributingFactors: [
          'No automated schema comparison in upgrade pipeline',
          'Staging environment did not have same materialized views as production',
          'Upgrade tested only with standard tables, not views',
        ],
        rootCauseCategory: RootCauseCategory.PROCESS_FAILURE,
        detectionGap:
          'No monitoring for materialized view existence/freshness. Alert only on HTTP 500 rate.',
        monitoringGap:
          'Missing: schema drift detection, materialized view health checks, ' +
          'pre/post upgrade automated validation.',
        rcaEntries: [
          {
            type: RcaEntryType.TIMELINE,
            content: '02:00 — Change window opens, pg_upgrade starts',
            order: 1,
          },
          {
            type: RcaEntryType.TIMELINE,
            content: '02:40 — pg_upgrade completes, API restart initiated',
            order: 2,
          },
          {
            type: RcaEntryType.TIMELINE,
            content:
              '02:45 — API starts returning 500s on transaction endpoints',
            order: 3,
          },
          {
            type: RcaEntryType.ROOT_CAUSE,
            content:
              'pg_upgrade does not preserve materialized views; runbook did not include recreation step',
            order: 4,
          },
          {
            type: RcaEntryType.CONTRIBUTING_FACTOR,
            content:
              'Staging environment lacked equivalent materialized views, so gap was not caught in pre-prod',
            order: 5,
          },
          {
            type: RcaEntryType.CORRECTIVE_ACTION,
            content:
              'Recreate materialized views from pre-upgrade schema dump and refresh',
            order: 6,
          },
          {
            type: RcaEntryType.PREVENTIVE_ACTION,
            content: 'Add automated schema diff check to DB upgrade pipeline',
            order: 7,
          },
          {
            type: RcaEntryType.LESSON_LEARNED,
            content:
              'Always validate materialized views, custom types, and extensions after pg_upgrade',
            order: 8,
          },
        ],
        metadata: {
          scenario: 'scenario-pack',
          relatedMajorIncident: 'MI-SCEN-001',
        },
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      } as Partial<ItsmProblem>,
      'PRB-SCEN-001 — Schema Compat',
      'Problem',
    );
    track(probAction);

    // Problem-Incident links
    const probIncLinks: Array<{
      incidentId: string;
      linkType: ProblemIncidentLinkType;
      label: string;
    }> = [
      {
        incidentId: ID.INC_API_500,
        linkType: ProblemIncidentLinkType.PRIMARY_SYMPTOM,
        label: 'PRB → INC-001 (primary)',
      },
      {
        incidentId: ID.INC_LOGIN_FAIL,
        linkType: ProblemIncidentLinkType.RELATED,
        label: 'PRB → INC-002 (related)',
      },
      {
        incidentId: ID.INC_TIMEOUT,
        linkType: ProblemIncidentLinkType.RELATED,
        label: 'PRB → INC-003 (related)',
      },
    ];

    for (const piLink of probIncLinks) {
      const existing = await probIncRepo.findOne({
        where: {
          tenantId: DEMO_TENANT_ID,
          problemId: ID.PROB_SCHEMA_COMPAT,
          incidentId: piLink.incidentId,
        },
      });
      if (existing) {
        logAction('REUSED', 'Prob-Inc', piLink.label);
        track('REUSED');
      } else {
        const entity = probIncRepo.create({
          tenantId: DEMO_TENANT_ID,
          problemId: ID.PROB_SCHEMA_COMPAT,
          incidentId: piLink.incidentId,
          linkType: piLink.linkType,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
        await probIncRepo.save(entity);
        logAction('CREATED', 'Prob-Inc', piLink.label);
        track('CREATED');
      }
    }

    // Problem-Change link
    const existingProbChg = await probChgRepo.findOne({
      where: {
        tenantId: DEMO_TENANT_ID,
        problemId: ID.PROB_SCHEMA_COMPAT,
        changeId: ID.CHANGE_DB_UPGRADE,
        relationType: ProblemChangeLinkType.INVESTIGATES,
      },
    });
    if (existingProbChg) {
      logAction('REUSED', 'Prob-Chg', 'PRB → CHG (investigates)');
      track('REUSED');
    } else {
      const entity = probChgRepo.create({
        tenantId: DEMO_TENANT_ID,
        problemId: ID.PROB_SCHEMA_COMPAT,
        changeId: ID.CHANGE_DB_UPGRADE,
        relationType: ProblemChangeLinkType.INVESTIGATES,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      await probChgRepo.save(entity);
      logAction('CREATED', 'Prob-Chg', 'PRB → CHG (investigates)');
      track('CREATED');
    }

    // Known Error
    const { action: keAction } = await upsertById(
      keRepo,
      ID.KE_SCHEMA_WORKAROUND,
      {
        tenantId: DEMO_TENANT_ID,
        title: 'Missing materialized views after PostgreSQL pg_upgrade',
        symptoms:
          'Core Banking API returns HTTP 500 with "relation <view_name> does not exist" ' +
          'for materialized views: account_ledger_v2, txn_summary_daily, auth_session_cache.',
        rootCause:
          'pg_upgrade utility does not automatically migrate materialized views. ' +
          'Views must be manually re-created from the pre-upgrade schema dump.',
        workaround:
          '1. Extract materialized view definitions from pre-upgrade pg_dump\n' +
          '2. Execute CREATE MATERIALIZED VIEW statements\n' +
          '3. Run REFRESH MATERIALIZED VIEW CONCURRENTLY for each view\n' +
          '4. Verify Core API health check passes\n' +
          'Estimated time: 15 minutes',
        permanentFixStatus: KnownErrorFixStatus.WORKAROUND_AVAILABLE,
        state: KnownErrorState.PUBLISHED,
        publishedAt: hoursAgo(1),
        problemId: ID.PROB_SCHEMA_COMPAT,
        knowledgeCandidate: true,
        knowledgeCandidatePayload: {
          suggestedTitle:
            'KB: Materialized views lost during PostgreSQL major version upgrade',
          suggestedCategory: 'Database Operations',
          suggestedTags: [
            'postgresql',
            'pg_upgrade',
            'materialized-views',
            'migration',
          ],
        },
        metadata: {
          scenario: 'scenario-pack',
        },
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      } as Partial<ItsmKnownError>,
      'KE — Missing materialized views after pg_upgrade',
      'KnownError',
    );
    track(keAction);
    console.log('');

    // ======================================================================
    // SUMMARY
    // ======================================================================
    console.log('='.repeat(70));
    console.log('  SCENARIO DATA PACK — Seed Complete');
    console.log('='.repeat(70));
    console.log('');
    console.log(
      `  Records: ${stats.created} CREATED, ${stats.reused} REUSED, ${stats.updated} UPDATED`,
    );
    console.log('');
    console.log('  SCENARIO GRAPH:');
    console.log(
      '  ┌─────────────────────────────────────────────────────────┐',
    );
    console.log('  │ Service: SCEN-Online-Banking-Platform (Tier-1)         │');
    console.log('  │ ├─ Offering: SCEN-Retail-Banking-Portal                │');
    console.log('  │ └─ Offering: SCEN-Corporate-Banking-API               │');
    console.log(
      '  │                                                         │',
    );
    console.log('  │ CIs: FW → WEB → API → DB → DB-BKP                     │');
    console.log(
      '  │            │       └→ Cache                             │',
    );
    console.log(
      '  │            └→ Cache                                     │',
    );
    console.log(
      '  │      API runs_on SRV                                    │',
    );
    console.log(
      '  │                                                         │',
    );
    console.log('  │ Change: CHG-SCEN-001 (DB Upgrade, HIGH risk, score 78) │');
    console.log('  │   └→ Affects: DB, API, WEB, Cache, FW                  │');
    console.log(
      '  │                                                         │',
    );
    console.log('  │ Major Incident: MI-SCEN-001 (SEV1, INVESTIGATING)      │');
    console.log('  │   ├→ INC-SCEN-001 (API 500, P1)                       │');
    console.log('  │   ├→ INC-SCEN-002 (Login fail, P1)                    │');
    console.log('  │   ├→ INC-SCEN-003 (Timeout, P2, partial data)         │');
    console.log('  │   └→ Linked: CHG, Service, 2 CIs                      │');
    console.log(
      '  │                                                         │',
    );
    console.log('  │ Problem: PRB-SCEN-001 (KNOWN_ERROR state)              │');
    console.log('  │   ├→ 3 incidents linked                                │');
    console.log('  │   ├→ Change linked (INVESTIGATES)                      │');
    console.log('  │   ├→ 8 RCA entries (timeline, root cause, actions)     │');
    console.log('  │   └→ Phase-2 RCA: 5-whys, contributing factors,        │');
    console.log(
      '  │      root cause category, detection/monitoring gaps     │',
    );
    console.log(
      '  │                                                         │',
    );
    console.log('  │ Known Error: KE (PUBLISHED, workaround available)      │');
    console.log('  │   └→ Knowledge candidate flagged                       │');
    console.log(
      '  └─────────────────────────────────────────────────────────┘',
    );
    console.log('');
    console.log('  DETERMINISTIC IDS:');
    console.log(`    Service:  ${ID.SVC_ONLINE_BANKING}`);
    console.log(`    Change:   ${ID.CHANGE_DB_UPGRADE}`);
    console.log(`    MI:       ${ID.MI_BANKING_OUTAGE}`);
    console.log(`    Problem:  ${ID.PROB_SCHEMA_COMPAT}`);
    console.log(`    KE:       ${ID.KE_SCHEMA_WORKAROUND}`);
    console.log('');
    console.log('  VALIDATION ENDPOINTS:');
    console.log(`    GET /grc/cmdb/topology/ci/${ID.CI_PRIMARY_DB}?depth=3`);
    console.log(
      `    GET /grc/cmdb/topology/service/${ID.SVC_ONLINE_BANKING}?depth=3`,
    );
    console.log(`    GET /grc/itsm/major-incidents/${ID.MI_BANKING_OUTAGE}`);
    console.log(`    GET /grc/itsm/problems/${ID.PROB_SCHEMA_COMPAT}`);
    console.log(`    GET /grc/itsm/known-errors/${ID.KE_SCHEMA_WORKAROUND}`);
    console.log(`    GET /grc/itsm/changes/${ID.CHANGE_DB_UPGRADE}`);
    console.log('');
    const durationMs = Date.now() - scriptStart;
    console.log(
      `[SEED-SCENARIO-PACK] Duration: ${durationMs}ms (${(durationMs / 1000).toFixed(1)}s)`,
    );
    console.log(`[SEED-SCENARIO-PACK] End: ${new Date().toISOString()}`);
  } catch (error) {
    console.error('[SEED-SCENARIO-PACK] Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
    if (safetyTimer) clearTimeout(safetyTimer);
  }
}

// Export IDs for use in tests
export const SCENARIO_PACK_IDS = ID;
export const SCENARIO_TENANT_ID = DEMO_TENANT_ID;

// Only run when executed directly (not when imported by tests)
if (require.main === module) {
  seedScenarioPack()
    .then(() => process.exit(process.exitCode ?? 0))
    .catch((error) => {
      console.error('[SEED-SCENARIO-PACK] Unhandled error:', error);
      process.exit(1);
    });
}
