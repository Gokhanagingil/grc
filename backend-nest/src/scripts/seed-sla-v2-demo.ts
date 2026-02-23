process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { SlaDefinition, SlaMetric, SlaSchedule } from '../itsm/sla/sla-definition.entity';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

// Use deterministic UUIDs for the demo CMDB services (from seed-service-portfolio)
const SERVICE_EMAIL = 'E-Mail Service';
const SERVICE_ERP = 'ERP System';

/**
 * SLA Engine 2.0 Demo Seed Pack
 *
 * Creates multi-dimensional SLA policies with condition trees
 * demonstrating customer/service/priority combinations.
 */

interface SlaV2Seed {
  name: string;
  description: string;
  metric: SlaMetric;
  targetSeconds: number;
  schedule: SlaSchedule;
  stopOnStates: string[];
  pauseOnStates: string[] | null;
  order: number;
  priorityFilter: string[] | null;
  // v2 fields
  appliesToRecordType: string;
  conditionTree: Record<string, unknown> | null;
  responseTimeSeconds: number | null;
  resolutionTimeSeconds: number | null;
  priorityWeight: number;
  stopProcessing: boolean;
  version: number;
}

const SLA_V2_DEFINITIONS: SlaV2Seed[] = [
  // ── Customer A + Service X (E-Mail) + P1 ───────────────────────────
  {
    name: 'SLA-INC-CustA-Email-P1',
    description:
      'Customer A + E-Mail Service + P1: 60 min response, 240 min resolution',
    metric: SlaMetric.RESOLUTION_TIME,
    targetSeconds: 14400, // 240 min legacy fallback
    schedule: SlaSchedule.TWENTY_FOUR_SEVEN,
    stopOnStates: ['RESOLVED', 'CLOSED'],
    pauseOnStates: null,
    order: 100,
    priorityFilter: ['P1'],
    appliesToRecordType: 'INCIDENT',
    conditionTree: {
      operator: 'AND',
      children: [
        { field: 'priority', operator: 'is', value: 'P1' },
        { field: 'relatedService', operator: 'is', value: SERVICE_EMAIL },
        { field: 'assignmentGroup', operator: 'is', value: 'Customer-A-Team' },
      ],
    },
    responseTimeSeconds: 3600, // 60 min
    resolutionTimeSeconds: 14400, // 240 min
    priorityWeight: 100,
    stopProcessing: false,
    version: 2,
  },

  // ── Customer A + Service Y (ERP) + P1 ──────────────────────────────
  {
    name: 'SLA-INC-CustA-ERP-P1',
    description:
      'Customer A + ERP System + P1: 120 min response, 360 min resolution',
    metric: SlaMetric.RESOLUTION_TIME,
    targetSeconds: 21600, // 360 min legacy fallback
    schedule: SlaSchedule.TWENTY_FOUR_SEVEN,
    stopOnStates: ['RESOLVED', 'CLOSED'],
    pauseOnStates: null,
    order: 110,
    priorityFilter: ['P1'],
    appliesToRecordType: 'INCIDENT',
    conditionTree: {
      operator: 'AND',
      children: [
        { field: 'priority', operator: 'is', value: 'P1' },
        { field: 'relatedService', operator: 'is', value: SERVICE_ERP },
        { field: 'assignmentGroup', operator: 'is', value: 'Customer-A-Team' },
      ],
    },
    responseTimeSeconds: 7200, // 120 min
    resolutionTimeSeconds: 21600, // 360 min
    priorityWeight: 100,
    stopProcessing: false,
    version: 2,
  },

  // ── Customer B + Service X (E-Mail) + P1 ───────────────────────────
  {
    name: 'SLA-INC-CustB-Email-P1',
    description:
      'Customer B + E-Mail Service + P1: 180 min response, 480 min resolution',
    metric: SlaMetric.RESOLUTION_TIME,
    targetSeconds: 28800, // 480 min legacy fallback
    schedule: SlaSchedule.TWENTY_FOUR_SEVEN,
    stopOnStates: ['RESOLVED', 'CLOSED'],
    pauseOnStates: null,
    order: 120,
    priorityFilter: ['P1'],
    appliesToRecordType: 'INCIDENT',
    conditionTree: {
      operator: 'AND',
      children: [
        { field: 'priority', operator: 'is', value: 'P1' },
        { field: 'relatedService', operator: 'is', value: SERVICE_EMAIL },
        { field: 'assignmentGroup', operator: 'is', value: 'Customer-B-Team' },
      ],
    },
    responseTimeSeconds: 10800, // 180 min
    resolutionTimeSeconds: 28800, // 480 min
    priorityWeight: 100,
    stopProcessing: false,
    version: 2,
  },

  // ── Customer B + Service Y (ERP) + P1 ──────────────────────────────
  {
    name: 'SLA-INC-CustB-ERP-P1',
    description:
      'Customer B + ERP System + P1: 60 min response, 240 min resolution',
    metric: SlaMetric.RESOLUTION_TIME,
    targetSeconds: 14400, // 240 min
    schedule: SlaSchedule.TWENTY_FOUR_SEVEN,
    stopOnStates: ['RESOLVED', 'CLOSED'],
    pauseOnStates: null,
    order: 130,
    priorityFilter: ['P1'],
    appliesToRecordType: 'INCIDENT',
    conditionTree: {
      operator: 'AND',
      children: [
        { field: 'priority', operator: 'is', value: 'P1' },
        { field: 'relatedService', operator: 'is', value: SERVICE_ERP },
        { field: 'assignmentGroup', operator: 'is', value: 'Customer-B-Team' },
      ],
    },
    responseTimeSeconds: 3600, // 60 min
    resolutionTimeSeconds: 14400, // 240 min
    priorityWeight: 100,
    stopProcessing: false,
    version: 2,
  },

  // ── Generic P2 Fallback ────────────────────────────────────────────
  {
    name: 'SLA-INC-Generic-P2',
    description:
      'Generic P2 fallback: 240 min response, 1440 min resolution (24 hours)',
    metric: SlaMetric.RESOLUTION_TIME,
    targetSeconds: 86400, // 1440 min legacy fallback
    schedule: SlaSchedule.TWENTY_FOUR_SEVEN,
    stopOnStates: ['RESOLVED', 'CLOSED'],
    pauseOnStates: null,
    order: 200,
    priorityFilter: ['P2'],
    appliesToRecordType: 'INCIDENT',
    conditionTree: {
      operator: 'AND',
      children: [{ field: 'priority', operator: 'is', value: 'P2' }],
    },
    responseTimeSeconds: 14400, // 240 min
    resolutionTimeSeconds: 86400, // 1440 min
    priorityWeight: 10,
    stopProcessing: false,
    version: 2,
  },

  // ── Generic P3 Fallback ────────────────────────────────────────────
  {
    name: 'SLA-INC-Generic-P3',
    description:
      'Generic P3 fallback: 480 min response, 2880 min resolution (48 hours)',
    metric: SlaMetric.RESOLUTION_TIME,
    targetSeconds: 172800, // 2880 min legacy fallback
    schedule: SlaSchedule.BUSINESS_HOURS,
    stopOnStates: ['RESOLVED', 'CLOSED'],
    pauseOnStates: null,
    order: 210,
    priorityFilter: ['P3'],
    appliesToRecordType: 'INCIDENT',
    conditionTree: {
      operator: 'AND',
      children: [{ field: 'priority', operator: 'is', value: 'P3' }],
    },
    responseTimeSeconds: 28800, // 480 min
    resolutionTimeSeconds: 172800, // 2880 min
    priorityWeight: 5,
    stopProcessing: false,
    version: 2,
  },

  // ── High-Impact Any-Priority ───────────────────────────────────────
  {
    name: 'SLA-INC-HighImpact-Any',
    description:
      'High-impact incidents regardless of priority: 120 min response, 480 min resolution',
    metric: SlaMetric.RESOLUTION_TIME,
    targetSeconds: 28800,
    schedule: SlaSchedule.TWENTY_FOUR_SEVEN,
    stopOnStates: ['RESOLVED', 'CLOSED'],
    pauseOnStates: null,
    order: 300,
    priorityFilter: null,
    appliesToRecordType: 'INCIDENT',
    conditionTree: {
      operator: 'AND',
      children: [{ field: 'impact', operator: 'is', value: 'HIGH' }],
    },
    responseTimeSeconds: 7200, // 120 min
    resolutionTimeSeconds: 28800, // 480 min
    priorityWeight: 50,
    stopProcessing: false,
    version: 2,
  },
];

async function seedSlaV2Demo() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const ds = app.get(DataSource);
  const repo = ds.getRepository(SlaDefinition);

  let created = 0;
  let skipped = 0;

  for (const seed of SLA_V2_DEFINITIONS) {
    const existing = await repo.findOne({
      where: { tenantId: DEMO_TENANT_ID, name: seed.name },
    });

    if (existing) {
      skipped++;
      continue;
    }

    const entity = repo.create({
      tenantId: DEMO_TENANT_ID,
      createdBy: DEMO_ADMIN_ID,
      isDeleted: false,
      isActive: true,
      businessStartHour: 9,
      businessEndHour: 17,
      businessDays: [1, 2, 3, 4, 5],
      serviceIdFilter: null,
      ...seed,
    });

    await repo.save(entity);
    created++;
  }

  console.log(
    `\n  SLA v2 Demo Seed: ${created} created, ${skipped} skipped (already exist)\n`,
  );

  await app.close();
}

seedSlaV2Demo().catch((err) => {
  console.error('SLA v2 seed failed:', err);
  process.exit(1);
});
