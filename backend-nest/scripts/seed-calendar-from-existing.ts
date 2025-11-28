#!/usr/bin/env ts-node
/**
 * Seed Calendar Events from Existing Data
 * 
 * Creates calendar events from existing audit engagements and BCP exercises.
 * This script is idempotent: running it multiple times won't create duplicates.
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/seed-calendar-from-existing.ts
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions, MoreThanOrEqual } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { CalendarEventEntity, CalendarEventType, CalendarEventStatus } from '../src/entities/app/calendar-event.entity';
import { AuditEngagementEntity, AuditEngagementStatus } from '../src/entities/app/audit-engagement.entity';
import { AuditPlanEntity } from '../src/entities/app/audit-plan.entity';
import { AuditTestEntity } from '../src/entities/app/audit-test.entity';
import { AuditEvidenceEntity } from '../src/entities/app/audit-evidence.entity';
import { AuditFindingEntity } from '../src/entities/app/audit-finding.entity';
import { CorrectiveActionEntity } from '../src/entities/app/corrective-action.entity';
import { BCPExerciseEntity } from '../src/entities/app/bcp-exercise.entity';
import { BCPPlanEntity } from '../src/entities/app/bcp-plan.entity';
import { TenantEntity } from '../src/entities/tenant/tenant.entity';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';

function determineDataSourceOptions(): DataSourceOptions {
  const dbType = (process.env.DB_TYPE || 'sqlite').toLowerCase();
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'grc.sqlite');

  if (dbType === 'sqlite') {
    return {
      type: 'sqlite',
      database: dbPath,
      entities: [
        CalendarEventEntity,
        AuditEngagementEntity,
        AuditPlanEntity,
        AuditTestEntity,
        AuditEvidenceEntity,
        AuditFindingEntity,
        CorrectiveActionEntity,
        BCPExerciseEntity,
        BCPPlanEntity,
        TenantEntity,
      ],
      synchronize: false,
      logging: false,
    };
  } else {
    return {
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'grc',
      entities: [
        CalendarEventEntity,
        AuditEngagementEntity,
        AuditPlanEntity,
        AuditTestEntity,
        AuditEvidenceEntity,
        AuditFindingEntity,
        CorrectiveActionEntity,
        BCPExerciseEntity,
        BCPPlanEntity,
        TenantEntity,
      ],
      synchronize: false,
      logging: false,
    };
  }
}

async function seedCalendarEvents() {
  const options = determineDataSourceOptions();
  const dataSource = new DataSource(options);

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');

    const calendarRepo = dataSource.getRepository(CalendarEventEntity);
    const engagementRepo = dataSource.getRepository(AuditEngagementEntity);
    const planRepo = dataSource.getRepository(AuditPlanEntity);
    const exerciseRepo = dataSource.getRepository(BCPExerciseEntity);

    const tenantId = DEFAULT_TENANT_ID;

    // 1. Process Audit Engagements
    console.log('\n[SEED] Processing Audit Engagements...');
    const engagements = await engagementRepo.find({
      where: { tenant_id: tenantId },
      relations: ['plan'],
    });

    let engagementEventsCreated = 0;
    let engagementEventsUpdated = 0;

    for (const engagement of engagements) {
      // Load plan if not loaded
      let plan = engagement.plan;
      if (!plan) {
        const foundPlan = await planRepo.findOne({
          where: { id: engagement.plan_id, tenant_id: tenantId },
        });
        plan = foundPlan || undefined;
      }

      if (!plan || !plan.period_start || !plan.period_end) {
        console.log(`  ⚠️  Skipping engagement ${engagement.code}: plan dates missing`);
        continue;
      }

      // Check if calendar event already exists
      const existingEvents = await calendarRepo.find({
        where: {
          tenant_id: tenantId,
          source_module: 'audit',
          source_entity: 'AuditEngagement',
          source_id: engagement.id,
        },
      });

      const startAt = new Date(plan.period_start);
      const endAt = new Date(plan.period_end);

      // Map engagement status to calendar event status
      let calendarStatus = CalendarEventStatus.PLANNED;
      if (engagement.status === AuditEngagementStatus.COMPLETED) {
        calendarStatus = CalendarEventStatus.COMPLETED;
      } else if (engagement.status === AuditEngagementStatus.IN_PROGRESS) {
        calendarStatus = CalendarEventStatus.CONFIRMED;
      } else if (engagement.status === AuditEngagementStatus.CANCELLED) {
        calendarStatus = CalendarEventStatus.CANCELLED;
      }

      if (existingEvents.length > 0) {
        // Update existing event
        const existingEvent = existingEvents[0];
        if (existingEvent) {
          existingEvent.title = `${engagement.code}: ${engagement.name}`;
          existingEvent.description = engagement.auditee ? `Auditee: ${engagement.auditee}` : undefined;
          existingEvent.start_at = startAt;
          existingEvent.end_at = endAt;
          existingEvent.status = calendarStatus;
          existingEvent.owner_user_id = engagement.lead_auditor_id;
          await calendarRepo.save(existingEvent);
          engagementEventsUpdated++;
          console.log(`  ✅ Updated calendar event for engagement ${engagement.code}`);
        }
      } else {
        // Create new event
        const event = calendarRepo.create({
          id: randomUUID(),
          tenant_id: tenantId,
          title: `${engagement.code}: ${engagement.name}`,
          description: engagement.auditee ? `Auditee: ${engagement.auditee}` : undefined,
          event_type: CalendarEventType.AUDIT_ENGAGEMENT,
          source_module: 'audit',
          source_entity: 'AuditEngagement',
          source_id: engagement.id,
          start_at: startAt,
          end_at: endAt,
          status: calendarStatus,
          owner_user_id: engagement.lead_auditor_id,
        });
        await calendarRepo.save(event);
        engagementEventsCreated++;
        console.log(`  ✅ Created calendar event for engagement ${engagement.code}`);
      }
    }

    // 2. Process BCP Exercises
    console.log('\n[SEED] Processing BCP Exercises...');
    const exercises = await exerciseRepo.find({
      where: { tenant_id: tenantId },
    });

    let exerciseEventsCreated = 0;
    let exerciseEventsUpdated = 0;

    for (const exercise of exercises) {
      // Check if calendar event already exists
      const existingEvents = await calendarRepo.find({
        where: {
          tenant_id: tenantId,
          source_module: 'bcm',
          source_entity: 'BCPExercise',
          source_id: exercise.id,
        },
      });

      const exerciseDate = new Date(exercise.date);
      const startAt = new Date(exerciseDate);
      startAt.setHours(9, 0, 0, 0); // Default to 9 AM
      const endAt = new Date(exerciseDate);
      endAt.setHours(17, 0, 0, 0); // Default to 5 PM

      // Status: if result exists, it's completed; otherwise planned
      const calendarStatus = exercise.result
        ? CalendarEventStatus.COMPLETED
        : CalendarEventStatus.PLANNED;

      if (existingEvents.length > 0) {
        // Update existing event
        const existingEvent = existingEvents[0];
        if (existingEvent) {
          existingEvent.title = `${exercise.code}: ${exercise.name}`;
          existingEvent.description = exercise.scenario;
          existingEvent.start_at = startAt;
          existingEvent.end_at = endAt;
          existingEvent.status = calendarStatus;
          await calendarRepo.save(existingEvent);
          exerciseEventsUpdated++;
          console.log(`  ✅ Updated calendar event for exercise ${exercise.code}`);
        }
      } else {
        // Create new event
        const event = calendarRepo.create({
          id: randomUUID(),
          tenant_id: tenantId,
          title: `${exercise.code}: ${exercise.name}`,
          description: exercise.scenario,
          event_type: CalendarEventType.BCP_EXERCISE,
          source_module: 'bcm',
          source_entity: 'BCPExercise',
          source_id: exercise.id,
          start_at: startAt,
          end_at: endAt,
          status: calendarStatus,
        });
        await calendarRepo.save(event);
        exerciseEventsCreated++;
        console.log(`  ✅ Created calendar event for exercise ${exercise.code}`);
      }
    }

    // 3. Create some future events for demo purposes (if no events exist in next 90 days)
    console.log('\n[SEED] Creating future demo events...');
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 90);

    const existingFutureEvents = await calendarRepo.find({
      where: {
        tenant_id: tenantId,
        start_at: MoreThanOrEqual(now),
      },
    });

    if (existingFutureEvents.length < 5) {
      // Create a few demo events in the next 90 days
      const demoEvents = [
        {
          title: 'Q1 Security Audit Review',
          description: 'Quarterly security audit review meeting',
          event_type: CalendarEventType.AUDIT_ENGAGEMENT,
          daysFromNow: 7,
        },
        {
          title: 'BCP Tabletop Exercise',
          description: 'Business continuity plan tabletop exercise',
          event_type: CalendarEventType.BCP_EXERCISE,
          daysFromNow: 14,
        },
        {
          title: 'Risk Assessment Workshop',
          description: 'Quarterly risk assessment workshop',
          event_type: CalendarEventType.RISK_REVIEW,
          daysFromNow: 21,
        },
        {
          title: 'Compliance Review Meeting',
          description: 'Monthly compliance review meeting',
          event_type: CalendarEventType.AUDIT_ENGAGEMENT,
          daysFromNow: 30,
        },
        {
          title: 'BCP Plan Update',
          description: 'Annual BCP plan update and review',
          event_type: CalendarEventType.BCP_PLAN_REVIEW,
          daysFromNow: 45,
        },
      ];

      let demoEventsCreated = 0;
      for (const demo of demoEvents) {
        const eventDate = new Date(now);
        eventDate.setDate(eventDate.getDate() + demo.daysFromNow);
        const startAt = new Date(eventDate);
        startAt.setHours(9, 0, 0, 0);
        const endAt = new Date(eventDate);
        endAt.setHours(17, 0, 0, 0);

        // Check if similar event already exists
        const existing = await calendarRepo.findOne({
          where: {
            tenant_id: tenantId,
            title: demo.title,
            start_at: startAt,
          },
        });

        if (!existing) {
          const event = calendarRepo.create({
            id: randomUUID(),
            tenant_id: tenantId,
            title: demo.title,
            description: demo.description,
            event_type: demo.event_type,
            source_module: 'demo',
            source_entity: 'DemoEvent',
            source_id: randomUUID(),
            start_at: startAt,
            end_at: endAt,
            status: CalendarEventStatus.PLANNED,
          });
          await calendarRepo.save(event);
          demoEventsCreated++;
          console.log(`  ✅ Created demo event: ${demo.title}`);
        }
      }
      console.log(`  Demo Events: ${demoEventsCreated} created`);
    } else {
      console.log(`  ⚠️  Skipping demo events (${existingFutureEvents.length} future events already exist)`);
    }

    console.log('\n✅ Calendar seed completed!');
    console.log(`  Audit Engagements: ${engagementEventsCreated} created, ${engagementEventsUpdated} updated`);
    console.log(`  BCP Exercises: ${exerciseEventsCreated} created, ${exerciseEventsUpdated} updated`);
    console.log(`  Total: ${engagementEventsCreated + exerciseEventsCreated} new events, ${engagementEventsUpdated + exerciseEventsUpdated} updated events`);

  } catch (error: any) {
    console.error('❌ Calendar seed failed:', error?.message || error);
    if (error?.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

seedCalendarEvents();

