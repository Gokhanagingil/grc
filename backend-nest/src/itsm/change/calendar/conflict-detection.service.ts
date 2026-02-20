import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalendarConflict, ConflictType, ConflictSeverity } from './calendar-conflict.entity';
import { CalendarEventService } from './calendar-event.service';
import { FreezeWindowService } from './freeze-window.service';
import { CalendarEvent } from './calendar-event.entity';
import { FreezeWindow } from './freeze-window.entity';

export interface ConflictResult {
  conflictType: string;
  severity: string;
  conflictingEventId?: string;
  conflictingFreezeId?: string;
  details: Record<string, unknown>;
}

const ADJACENCY_THRESHOLD_MS = 30 * 60 * 1000;

@Injectable()
export class ConflictDetectionService {
  constructor(
    @InjectRepository(CalendarConflict)
    private readonly conflictRepo: Repository<CalendarConflict>,
    private readonly calendarEventService: CalendarEventService,
    private readonly freezeWindowService: FreezeWindowService,
  ) {}

  detectOverlaps(
    startAt: Date,
    endAt: Date,
    events: CalendarEvent[],
    excludeChangeId?: string,
  ): ConflictResult[] {
    const results: ConflictResult[] = [];

    for (const event of events) {
      if (excludeChangeId && event.changeId === excludeChangeId) continue;

      const overlapStart = startAt < event.endAt && endAt > event.startAt;
      if (overlapStart) {
        results.push({
          conflictType: ConflictType.OVERLAP,
          severity: ConflictSeverity.HIGH,
          conflictingEventId: event.id,
          details: {
            eventTitle: event.title,
            eventStart: event.startAt.toISOString(),
            eventEnd: event.endAt.toISOString(),
          },
        });
      }
    }

    return results;
  }

  detectAdjacency(
    startAt: Date,
    endAt: Date,
    events: CalendarEvent[],
    excludeChangeId?: string,
  ): ConflictResult[] {
    const results: ConflictResult[] = [];

    for (const event of events) {
      if (excludeChangeId && event.changeId === excludeChangeId) continue;

      const gapBefore = startAt.getTime() - event.endAt.getTime();
      const gapAfter = event.startAt.getTime() - endAt.getTime();

      if (
        (gapBefore >= 0 && gapBefore <= ADJACENCY_THRESHOLD_MS) ||
        (gapAfter >= 0 && gapAfter <= ADJACENCY_THRESHOLD_MS)
      ) {
        results.push({
          conflictType: ConflictType.ADJACENCY,
          severity: ConflictSeverity.LOW,
          conflictingEventId: event.id,
          details: {
            eventTitle: event.title,
            gapMinutes: Math.round(
              Math.min(
                Math.abs(gapBefore),
                Math.abs(gapAfter),
              ) / 60000,
            ),
          },
        });
      }
    }

    return results;
  }

  detectFreezeConflicts(
    freezeWindows: FreezeWindow[],
  ): ConflictResult[] {
    return freezeWindows.map((fw) => ({
      conflictType: ConflictType.FREEZE_WINDOW,
      severity: ConflictSeverity.CRITICAL,
      conflictingFreezeId: fw.id,
      details: {
        freezeName: fw.name,
        freezeStart: fw.startAt.toISOString(),
        freezeEnd: fw.endAt.toISOString(),
        scope: fw.scope,
      },
    }));
  }

  async previewConflicts(
    tenantId: string,
    startAt: Date,
    endAt: Date,
    changeId?: string,
    serviceId?: string,
  ): Promise<ConflictResult[]> {
    const expandedStart = new Date(
      startAt.getTime() - ADJACENCY_THRESHOLD_MS,
    );
    const expandedEnd = new Date(endAt.getTime() + ADJACENCY_THRESHOLD_MS);

    const events = await this.calendarEventService.findOverlapping(
      tenantId,
      expandedStart,
      expandedEnd,
    );

    const freezeWindows =
      await this.freezeWindowService.findActiveOverlapping(
        tenantId,
        startAt,
        endAt,
        serviceId,
      );

    const overlaps = this.detectOverlaps(startAt, endAt, events, changeId);
    const adjacency = this.detectAdjacency(
      startAt,
      endAt,
      events,
      changeId,
    );
    const freezeConflicts = this.detectFreezeConflicts(freezeWindows);

    return [...freezeConflicts, ...overlaps, ...adjacency];
  }

  async clearConflictsForChange(
    tenantId: string,
    userId: string,
    changeId: string,
  ): Promise<void> {
    await this.conflictRepo
      .createQueryBuilder()
      .update(CalendarConflict)
      .set({ isDeleted: true, updatedBy: userId })
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('changeId = :changeId', { changeId })
      .andWhere('isDeleted = false')
      .execute();
  }

  async refreshConflictsForChange(
    tenantId: string,
    userId: string,
    changeId: string,
    startAt: Date,
    endAt: Date,
    serviceId?: string,
  ): Promise<CalendarConflict[]> {
    await this.clearConflictsForChange(tenantId, userId, changeId);

    const results = await this.previewConflicts(
      tenantId,
      startAt,
      endAt,
      changeId,
      serviceId,
    );

    const conflicts: CalendarConflict[] = [];
    for (const r of results) {
      const entity = this.conflictRepo.create({
        tenantId,
        changeId,
        conflictType: r.conflictType,
        conflictingEventId: r.conflictingEventId || null,
        conflictingFreezeId: r.conflictingFreezeId || null,
        severity: r.severity,
        details: r.details,
        createdBy: userId,
        isDeleted: false,
      });
      conflicts.push(await this.conflictRepo.save(entity));
    }

    return conflicts;
  }

  async getConflictsForChange(
    tenantId: string,
    changeId: string,
  ): Promise<CalendarConflict[]> {
    return this.conflictRepo.find({
      where: { tenantId, changeId, isDeleted: false },
      relations: ['conflictingEvent', 'conflictingFreeze'],
      order: { severity: 'DESC', createdAt: 'DESC' },
    });
  }
}
