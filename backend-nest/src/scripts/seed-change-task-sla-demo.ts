/**
 * Change Task SLA — Deterministic Demo Seed
 *
 * Creates SLA v2 policies targeting CHANGE_TASK record type
 * to demonstrate task-level SLA matching with condition trees.
 *
 * Policies:
 *   1. CRITICAL priority tasks → 1h response, 4h resolution
 *   2. HIGH priority + IMPLEMENTATION type → 2h response, 8h resolution
 *   3. Blocking tasks fallback → 4h resolution
 *   4. Generic fallback for all change tasks → 8h resolution
 *
 * IDEMPOTENCY: Records are looked up by name before insert.
 *
 * DEPENDENCIES: seed:grc (tenant must exist)
 *
 * Usage:
 *   DEV:  npx ts-node -r tsconfig-paths/register src/scripts/seed-change-task-sla-demo.ts
 *   PROD: node dist/scripts/seed-change-task-sla-demo.js
 */

process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import {
  SlaDefinition,
  SlaMetric,
  SlaSchedule,
} from '../itsm/sla/sla-definition.entity';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

interface ChangeTaskSlaSeed {
  name: string;
  description: string;
  metric: SlaMetric;
  targetSeconds: number;
  schedule: SlaSchedule;
  stopOnStates: string[];
  pauseOnStates: string[] | null;
  order: number;
  priorityFilter: string[] | null;
  appliesToRecordType: string;
  conditionTree: Record<string, unknown> | null;
  responseTimeSeconds: number | null;
  resolutionTimeSeconds: number | null;
  priorityWeight: number;
  stopProcessing: boolean;
  version: number;
}

const CHANGE_TASK_SLA_DEFINITIONS: ChangeTaskSlaSeed[] = [
  // ── CRITICAL priority tasks → fastest SLA ─────────────────────────
  {
    name: 'SLA-CTASK-Critical-All',
    description:
      'CRITICAL priority change tasks: 60 min response, 240 min resolution',
    metric: SlaMetric.RESOLUTION_TIME,
    targetSeconds: 14400,
    schedule: SlaSchedule.TWENTY_FOUR_SEVEN,
    stopOnStates: ['COMPLETED', 'CANCELLED', 'SKIPPED'],
    pauseOnStates: ['PENDING'],
    order: 400,
    priorityFilter: null,
    appliesToRecordType: 'CHANGE_TASK',
    conditionTree: {
      operator: 'AND',
      children: [{ field: 'priority', operator: 'is', value: 'CRITICAL' }],
    },
    responseTimeSeconds: 3600, // 60 min
    resolutionTimeSeconds: 14400, // 240 min
    priorityWeight: 100,
    stopProcessing: false,
    version: 2,
  },

  // ── HIGH priority + IMPLEMENTATION type → medium SLA ──────────────
  {
    name: 'SLA-CTASK-High-Implementation',
    description:
      'HIGH priority implementation tasks: 120 min response, 480 min resolution',
    metric: SlaMetric.RESOLUTION_TIME,
    targetSeconds: 28800,
    schedule: SlaSchedule.TWENTY_FOUR_SEVEN,
    stopOnStates: ['COMPLETED', 'CANCELLED', 'SKIPPED'],
    pauseOnStates: ['PENDING'],
    order: 410,
    priorityFilter: null,
    appliesToRecordType: 'CHANGE_TASK',
    conditionTree: {
      operator: 'AND',
      children: [
        { field: 'priority', operator: 'is', value: 'HIGH' },
        { field: 'taskType', operator: 'is', value: 'IMPLEMENTATION' },
      ],
    },
    responseTimeSeconds: 7200, // 120 min
    resolutionTimeSeconds: 28800, // 480 min
    priorityWeight: 80,
    stopProcessing: false,
    version: 2,
  },

  // ── Blocking tasks fallback ───────────────────────────────────────
  {
    name: 'SLA-CTASK-Blocking-Fallback',
    description:
      'Blocking change tasks: 240 min resolution (no response objective)',
    metric: SlaMetric.RESOLUTION_TIME,
    targetSeconds: 14400,
    schedule: SlaSchedule.BUSINESS_HOURS,
    stopOnStates: ['COMPLETED', 'CANCELLED', 'SKIPPED'],
    pauseOnStates: ['PENDING'],
    order: 420,
    priorityFilter: null,
    appliesToRecordType: 'CHANGE_TASK',
    conditionTree: {
      operator: 'AND',
      children: [{ field: 'isBlocking', operator: 'is', value: 'true' }],
    },
    responseTimeSeconds: null,
    resolutionTimeSeconds: 14400, // 240 min
    priorityWeight: 30,
    stopProcessing: false,
    version: 2,
  },

  // ── Generic fallback for all change tasks ─────────────────────────
  {
    name: 'SLA-CTASK-Generic-Fallback',
    description:
      'Generic change task SLA: 480 min resolution for any unmatched task',
    metric: SlaMetric.RESOLUTION_TIME,
    targetSeconds: 28800,
    schedule: SlaSchedule.BUSINESS_HOURS,
    stopOnStates: ['COMPLETED', 'CANCELLED', 'SKIPPED'],
    pauseOnStates: ['PENDING'],
    order: 500,
    priorityFilter: null,
    appliesToRecordType: 'CHANGE_TASK',
    conditionTree: null,
    responseTimeSeconds: null,
    resolutionTimeSeconds: 28800, // 480 min
    priorityWeight: 1,
    stopProcessing: false,
    version: 2,
  },
];

async function seedChangeTaskSlaDemoPolicies(): Promise<void> {
  console.log('');
  console.log('='.repeat(60));
  console.log('  CHANGE TASK SLA — Demo Seed Pack');
  console.log('  Policies: 4 (CRITICAL, HIGH+IMPL, Blocking, Generic)');
  console.log('='.repeat(60));
  console.log('');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const ds = app.get(DataSource);
  const repo = ds.getRepository(SlaDefinition);

  let created = 0;
  let skipped = 0;

  for (const seed of CHANGE_TASK_SLA_DEFINITIONS) {
    const existing = await repo.findOne({
      where: { tenantId: DEMO_TENANT_ID, name: seed.name },
    });

    if (existing) {
      console.log(`   = REUSED: ${seed.name}`);
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
    console.log(`   + CREATED: ${seed.name}`);
    created++;
  }

  console.log(
    `\n  Change Task SLA Seed: ${created} created, ${skipped} skipped (already exist)\n`,
  );

  await app.close();
}

seedChangeTaskSlaDemoPolicies().catch((err) => {
  console.error('Change Task SLA seed failed:', err);
  process.exit(1);
});
