/**
 * CAB Meeting & Agenda — Deterministic Demo Seed
 *
 * Creates a rich demo dataset for CAB (Change Advisory Board) management:
 * 1. Three CAB meetings in different states (SCHEDULED, IN_PROGRESS, COMPLETED)
 * 2. Agenda items linking existing seeded changes to meetings
 * 3. Mixed decision statuses (APPROVED, REJECTED, DEFERRED, CONDITIONAL, PENDING)
 *
 * IDEMPOTENCY: Every record is looked up by deterministic ID before insert.
 *              Re-runs log CREATED / REUSED per record. No duplicate explosion.
 *
 * DEPENDENCIES: seed:grc (tenant must exist), seed-itsm-baseline (changes)
 *
 * Usage:
 *   DEV:  npx ts-node -r tsconfig-paths/register src/scripts/seed-cab-demo.ts
 *   PROD: node dist/scripts/seed-cab-demo.js
 */

process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { Tenant } from '../tenants/tenant.entity';
import {
  CabMeeting,
  CabMeetingStatus,
} from '../itsm/change/cab/cab-meeting.entity';
import {
  CabAgendaItem,
  CabDecisionStatus,
} from '../itsm/change/cab/cab-agenda-item.entity';
import { ItsmChange } from '../itsm/change/change.entity';

// ============================================================================
// DETERMINISTIC IDS — prefix cccc to avoid collision with other seeds
// ============================================================================

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

const ID = {
  // CAB Meetings
  MEETING_1: 'cccc0100-0000-0000-0000-000000000001',
  MEETING_2: 'cccc0100-0000-0000-0000-000000000002',
  MEETING_3: 'cccc0100-0000-0000-0000-000000000003',
  // Agenda Items
  AGENDA_1: 'cccc0200-0000-0000-0000-000000000001',
  AGENDA_2: 'cccc0200-0000-0000-0000-000000000002',
  AGENDA_3: 'cccc0200-0000-0000-0000-000000000003',
  AGENDA_4: 'cccc0200-0000-0000-0000-000000000004',
  AGENDA_5: 'cccc0200-0000-0000-0000-000000000005',
  AGENDA_6: 'cccc0200-0000-0000-0000-000000000006',
};

// ============================================================================
// HELPERS
// ============================================================================

type SeedAction = 'CREATED' | 'REUSED';

function logAction(action: SeedAction, entity: string, label: string): void {
  const icon = action === 'CREATED' ? '+' : '=';
  console.log(`   ${icon} ${action} ${entity}: ${label}`);
}

const NOW = new Date();
function hoursFromNow(h: number): Date {
  return new Date(NOW.getTime() + h * 60 * 60 * 1000);
}
function daysFromNow(d: number): Date {
  return new Date(NOW.getTime() + d * 24 * 60 * 60 * 1000);
}

// ============================================================================
// MAIN
// ============================================================================

async function seedCabDemo(): Promise<void> {
  console.log('');
  console.log('='.repeat(70));
  console.log('  CAB MEETING & AGENDA — Deterministic Demo Seed');
  console.log('  3 meetings, 6 agenda items, mixed decision statuses');
  console.log('='.repeat(70));
  console.log('');

  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);

  const stats = { created: 0, reused: 0 };
  function track(a: SeedAction): void {
    if (a === 'CREATED') stats.created++;
    else stats.reused++;
  }

  try {
    // ── Verify tenant ──
    console.log('LAYER 0: Verifying prerequisites...');
    const tenant = await ds
      .getRepository(Tenant)
      .findOne({ where: { id: DEMO_TENANT_ID } });
    if (!tenant) {
      console.error('  ERROR: Demo tenant not found. Run seed:grc first.');
      process.exit(1);
    }
    console.log(`  Tenant: ${tenant.name}`);

    // ── Find existing changes to link ──
    const changeRepo = ds.getRepository(ItsmChange);
    const existingChanges = await changeRepo.find({
      where: { tenantId: DEMO_TENANT_ID },
      order: { createdAt: 'ASC' },
      take: 6,
    });
    console.log(`  Found ${existingChanges.length} existing changes to link`);
    console.log('');

    // ── LAYER 1: CAB Meetings ──
    console.log('LAYER 1: Seeding CAB Meetings (3)...');
    const meetingRepo = ds.getRepository(CabMeeting);

    const meetings = [
      {
        id: ID.MEETING_1,
        code: 'CAB-DEMO-001',
        title: 'Weekly Change Review Board',
        status: CabMeetingStatus.COMPLETED,
        meetingAt: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        endAt: new Date(
          NOW.getTime() - 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000,
        ),
        notes:
          'Regular weekly CAB meeting. All standard and normal changes reviewed.',
        summary:
          'Reviewed 3 changes: 2 approved, 1 deferred for additional risk analysis.',
      },
      {
        id: ID.MEETING_2,
        code: 'CAB-DEMO-002',
        title: 'Emergency CAB — Critical Infrastructure',
        status: CabMeetingStatus.SCHEDULED,
        meetingAt: hoursFromNow(4),
        endAt: hoursFromNow(5),
        notes:
          'Emergency CAB session for critical infrastructure changes requiring immediate review.',
        summary: null,
      },
      {
        id: ID.MEETING_3,
        code: 'CAB-DEMO-003',
        title: 'Monthly Change Planning Board',
        status: CabMeetingStatus.DRAFT,
        meetingAt: daysFromNow(7),
        endAt: daysFromNow(7),
        notes: 'Monthly planning session for upcoming major changes.',
        summary: null,
      },
    ];

    for (const m of meetings) {
      let existing = await meetingRepo.findOne({ where: { id: m.id } });
      if (!existing) {
        existing = meetingRepo.create({
          id: m.id,
          tenantId: DEMO_TENANT_ID,
          code: m.code,
          title: m.title,
          status: m.status,
          meetingAt: m.meetingAt,
          endAt: m.endAt,
          chairpersonId: DEMO_ADMIN_ID,
          notes: m.notes,
          summary: m.summary,
        });
        await meetingRepo.save(existing);
        logAction('CREATED', 'CabMeeting', m.title);
        track('CREATED');
      } else {
        logAction('REUSED', 'CabMeeting', m.title);
        track('REUSED');
      }
    }

    // ── LAYER 2: Agenda Items ──
    console.log('LAYER 2: Seeding Agenda Items (up to 6)...');
    const agendaRepo = ds.getRepository(CabAgendaItem);

    // Build agenda items linking changes to meetings
    const agendaItems: Array<{
      id: string;
      cabMeetingId: string;
      changeId: string;
      orderIndex: number;
      decisionStatus: CabDecisionStatus;
      decisionNote: string | null;
      conditions: string | null;
      decisionAt: Date | null;
    }> = [];

    // Meeting 1 (COMPLETED): link first 3 changes with decisions
    if (existingChanges.length >= 1) {
      agendaItems.push({
        id: ID.AGENDA_1,
        cabMeetingId: ID.MEETING_1,
        changeId: existingChanges[0].id,
        orderIndex: 0,
        decisionStatus: CabDecisionStatus.APPROVED,
        decisionNote:
          'Approved after risk review. Standard deployment procedure.',
        conditions: null,
        decisionAt: new Date(
          NOW.getTime() - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000,
        ),
      });
    }
    if (existingChanges.length >= 2) {
      agendaItems.push({
        id: ID.AGENDA_2,
        cabMeetingId: ID.MEETING_1,
        changeId: existingChanges[1].id,
        orderIndex: 1,
        decisionStatus: CabDecisionStatus.DEFERRED,
        decisionNote:
          'Deferred pending additional risk analysis. Reschedule for next CAB.',
        conditions: null,
        decisionAt: new Date(
          NOW.getTime() - 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000,
        ),
      });
    }
    if (existingChanges.length >= 3) {
      agendaItems.push({
        id: ID.AGENDA_3,
        cabMeetingId: ID.MEETING_1,
        changeId: existingChanges[2].id,
        orderIndex: 2,
        decisionStatus: CabDecisionStatus.CONDITIONAL,
        decisionNote:
          'Conditionally approved with mandatory backout plan verification.',
        conditions:
          'Must verify backout plan tested in staging before production deployment.',
        decisionAt: new Date(
          NOW.getTime() - 2 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000,
        ),
      });
    }

    // Meeting 2 (SCHEDULED): link next 2 changes as PENDING
    if (existingChanges.length >= 4) {
      agendaItems.push({
        id: ID.AGENDA_4,
        cabMeetingId: ID.MEETING_2,
        changeId: existingChanges[3].id,
        orderIndex: 0,
        decisionStatus: CabDecisionStatus.PENDING,
        decisionNote: null,
        conditions: null,
        decisionAt: null,
      });
    }
    if (existingChanges.length >= 5) {
      agendaItems.push({
        id: ID.AGENDA_5,
        cabMeetingId: ID.MEETING_2,
        changeId: existingChanges[4].id,
        orderIndex: 1,
        decisionStatus: CabDecisionStatus.PENDING,
        decisionNote: null,
        conditions: null,
        decisionAt: null,
      });
    }

    // Meeting 3 (DRAFT): link last change as PENDING
    if (existingChanges.length >= 6) {
      agendaItems.push({
        id: ID.AGENDA_6,
        cabMeetingId: ID.MEETING_3,
        changeId: existingChanges[5].id,
        orderIndex: 0,
        decisionStatus: CabDecisionStatus.PENDING,
        decisionNote: null,
        conditions: null,
        decisionAt: null,
      });
    }

    for (const ai of agendaItems) {
      let existing = await agendaRepo.findOne({ where: { id: ai.id } });
      if (!existing) {
        existing = agendaRepo.create({
          id: ai.id,
          tenantId: DEMO_TENANT_ID,
          cabMeetingId: ai.cabMeetingId,
          changeId: ai.changeId,
          orderIndex: ai.orderIndex,
          decisionStatus: ai.decisionStatus,
          decisionNote: ai.decisionNote,
          conditions: ai.conditions,
          decisionAt: ai.decisionAt,
          decisionById: ai.decisionAt ? DEMO_ADMIN_ID : undefined,
        });
        await agendaRepo.save(existing);
        logAction(
          'CREATED',
          'AgendaItem',
          `Meeting=${ai.cabMeetingId.slice(-4)} Change=${ai.changeId.slice(0, 8)} Decision=${ai.decisionStatus}`,
        );
        track('CREATED');
      } else {
        logAction(
          'REUSED',
          'AgendaItem',
          `Meeting=${ai.cabMeetingId.slice(-4)} Change=${ai.changeId.slice(0, 8)}`,
        );
        track('REUSED');
      }
    }

    // ── Summary ──
    console.log('');
    console.log('='.repeat(70));
    console.log(`  DONE: ${stats.created} created, ${stats.reused} reused`);
    console.log('  Meetings: 3 (COMPLETED, SCHEDULED, DRAFT)');
    console.log(`  Agenda Items: ${agendaItems.length}`);
    console.log('='.repeat(70));
    console.log('');
  } catch (err) {
    console.error('SEED ERROR:', err);
    process.exit(1);
  } finally {
    await app.close();
  }
}

void seedCabDemo();
