import { ConflictDetectionService, ConflictResult } from './conflict-detection.service';
import { CalendarEvent, CalendarEventType, CalendarEventStatus } from './calendar-event.entity';
import { FreezeWindow, FreezeScope } from './freeze-window.entity';
import { ConflictType, ConflictSeverity } from './calendar-conflict.entity';

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  const ev = new CalendarEvent();
  ev.id = overrides.id || 'evt-1';
  ev.tenantId = overrides.tenantId || 'tenant-1';
  ev.title = overrides.title || 'Test Event';
  ev.type = overrides.type || CalendarEventType.CHANGE;
  ev.status = overrides.status || CalendarEventStatus.SCHEDULED;
  ev.startAt = overrides.startAt || new Date('2026-03-01T10:00:00Z');
  ev.endAt = overrides.endAt || new Date('2026-03-01T12:00:00Z');
  ev.changeId = overrides.changeId !== undefined ? overrides.changeId : 'change-1';
  ev.isDeleted = false;
  return ev;
}

function makeFreeze(overrides: Partial<FreezeWindow> = {}): FreezeWindow {
  const fw = new FreezeWindow();
  fw.id = overrides.id || 'freeze-1';
  fw.tenantId = overrides.tenantId || 'tenant-1';
  fw.name = overrides.name || 'Test Freeze';
  fw.scope = overrides.scope || FreezeScope.GLOBAL;
  fw.startAt = overrides.startAt || new Date('2026-03-01T00:00:00Z');
  fw.endAt = overrides.endAt || new Date('2026-03-02T00:00:00Z');
  fw.isActive = overrides.isActive !== undefined ? overrides.isActive : true;
  fw.isDeleted = false;
  return fw;
}

describe('ConflictDetectionService', () => {
  let service: ConflictDetectionService;

  beforeEach(() => {
    service = new ConflictDetectionService(
      {} as never,
      {} as never,
      {} as never,
    );
  });

  describe('detectOverlaps', () => {
    it('should detect full overlap', () => {
      const start = new Date('2026-03-01T09:00:00Z');
      const end = new Date('2026-03-01T13:00:00Z');
      const events = [makeEvent()];

      const results = service.detectOverlaps(start, end, events);

      expect(results).toHaveLength(1);
      expect(results[0].conflictType).toBe(ConflictType.OVERLAP);
      expect(results[0].severity).toBe(ConflictSeverity.HIGH);
      expect(results[0].conflictingEventId).toBe('evt-1');
    });

    it('should detect partial overlap (start overlaps)', () => {
      const start = new Date('2026-03-01T11:00:00Z');
      const end = new Date('2026-03-01T14:00:00Z');
      const events = [makeEvent()];

      const results = service.detectOverlaps(start, end, events);

      expect(results).toHaveLength(1);
      expect(results[0].conflictType).toBe(ConflictType.OVERLAP);
    });

    it('should detect partial overlap (end overlaps)', () => {
      const start = new Date('2026-03-01T08:00:00Z');
      const end = new Date('2026-03-01T11:00:00Z');
      const events = [makeEvent()];

      const results = service.detectOverlaps(start, end, events);

      expect(results).toHaveLength(1);
    });

    it('should NOT detect overlap when events are adjacent (no gap)', () => {
      const start = new Date('2026-03-01T12:00:00Z');
      const end = new Date('2026-03-01T14:00:00Z');
      const events = [makeEvent()];

      const results = service.detectOverlaps(start, end, events);

      expect(results).toHaveLength(0);
    });

    it('should NOT detect overlap when events do not touch', () => {
      const start = new Date('2026-03-01T14:00:00Z');
      const end = new Date('2026-03-01T16:00:00Z');
      const events = [makeEvent()];

      const results = service.detectOverlaps(start, end, events);

      expect(results).toHaveLength(0);
    });

    it('should exclude same change via excludeChangeId', () => {
      const start = new Date('2026-03-01T09:00:00Z');
      const end = new Date('2026-03-01T13:00:00Z');
      const events = [makeEvent({ changeId: 'my-change' })];

      const results = service.detectOverlaps(start, end, events, 'my-change');

      expect(results).toHaveLength(0);
    });

    it('should detect multiple overlapping events', () => {
      const start = new Date('2026-03-01T09:00:00Z');
      const end = new Date('2026-03-01T15:00:00Z');
      const events = [
        makeEvent({ id: 'evt-1', startAt: new Date('2026-03-01T10:00:00Z'), endAt: new Date('2026-03-01T12:00:00Z') }),
        makeEvent({ id: 'evt-2', startAt: new Date('2026-03-01T13:00:00Z'), endAt: new Date('2026-03-01T14:00:00Z'), changeId: 'change-2' }),
      ];

      const results = service.detectOverlaps(start, end, events);

      expect(results).toHaveLength(2);
    });
  });

  describe('detectAdjacency', () => {
    it('should detect adjacency when gap is exactly 0 (adjacent)', () => {
      const start = new Date('2026-03-01T12:00:00Z');
      const end = new Date('2026-03-01T14:00:00Z');
      const events = [makeEvent()];

      const results = service.detectAdjacency(start, end, events);

      expect(results).toHaveLength(1);
      expect(results[0].conflictType).toBe(ConflictType.ADJACENCY);
      expect(results[0].severity).toBe(ConflictSeverity.LOW);
    });

    it('should detect adjacency when gap is 15 minutes (within 30-min threshold)', () => {
      const start = new Date('2026-03-01T12:15:00Z');
      const end = new Date('2026-03-01T14:00:00Z');
      const events = [makeEvent()];

      const results = service.detectAdjacency(start, end, events);

      expect(results).toHaveLength(1);
      expect(results[0].details).toHaveProperty('gapMinutes', 15);
    });

    it('should detect adjacency when gap is exactly 30 minutes (boundary)', () => {
      const start = new Date('2026-03-01T12:30:00Z');
      const end = new Date('2026-03-01T14:00:00Z');
      const events = [makeEvent()];

      const results = service.detectAdjacency(start, end, events);

      expect(results).toHaveLength(1);
      expect(results[0].details).toHaveProperty('gapMinutes', 30);
    });

    it('should NOT detect adjacency when gap is 31 minutes (beyond threshold)', () => {
      const start = new Date('2026-03-01T12:31:00Z');
      const end = new Date('2026-03-01T14:00:00Z');
      const events = [makeEvent()];

      const results = service.detectAdjacency(start, end, events);

      expect(results).toHaveLength(0);
    });

    it('should detect adjacency before the event (event starts after our end)', () => {
      const start = new Date('2026-03-01T08:00:00Z');
      const end = new Date('2026-03-01T09:50:00Z');
      const events = [makeEvent()];

      const results = service.detectAdjacency(start, end, events);

      expect(results).toHaveLength(1);
      expect(results[0].details).toHaveProperty('gapMinutes', 10);
    });

    it('should NOT detect adjacency when gap is large', () => {
      const start = new Date('2026-03-01T15:00:00Z');
      const end = new Date('2026-03-01T17:00:00Z');
      const events = [makeEvent()];

      const results = service.detectAdjacency(start, end, events);

      expect(results).toHaveLength(0);
    });

    it('should exclude same change via excludeChangeId', () => {
      const start = new Date('2026-03-01T12:00:00Z');
      const end = new Date('2026-03-01T14:00:00Z');
      const events = [makeEvent({ changeId: 'my-change' })];

      const results = service.detectAdjacency(start, end, events, 'my-change');

      expect(results).toHaveLength(0);
    });
  });

  describe('detectFreezeConflicts', () => {
    it('should return CRITICAL conflict for each freeze window', () => {
      const freezes = [makeFreeze()];

      const results = service.detectFreezeConflicts(freezes);

      expect(results).toHaveLength(1);
      expect(results[0].conflictType).toBe(ConflictType.FREEZE_WINDOW);
      expect(results[0].severity).toBe(ConflictSeverity.CRITICAL);
      expect(results[0].conflictingFreezeId).toBe('freeze-1');
      expect(results[0].details).toHaveProperty('freezeName', 'Test Freeze');
      expect(results[0].details).toHaveProperty('scope', FreezeScope.GLOBAL);
    });

    it('should return empty for no freeze windows', () => {
      const results = service.detectFreezeConflicts([]);

      expect(results).toHaveLength(0);
    });

    it('should return multiple conflicts for multiple freeze windows', () => {
      const freezes = [
        makeFreeze({ id: 'f1', name: 'Freeze 1' }),
        makeFreeze({ id: 'f2', name: 'Freeze 2', scope: FreezeScope.SERVICE }),
      ];

      const results = service.detectFreezeConflicts(freezes);

      expect(results).toHaveLength(2);
      expect(results[0].conflictingFreezeId).toBe('f1');
      expect(results[1].conflictingFreezeId).toBe('f2');
    });
  });

  describe('combined detection scenarios', () => {
    it('should handle overlap+adjacency correctly (overlap wins, no duplicate)', () => {
      const start = new Date('2026-03-01T11:00:00Z');
      const end = new Date('2026-03-01T13:00:00Z');
      const events = [makeEvent()];

      const overlaps = service.detectOverlaps(start, end, events);
      const adjacency = service.detectAdjacency(start, end, events);

      expect(overlaps).toHaveLength(1);
      expect(adjacency).toHaveLength(0);
    });

    it('should handle change within freeze + overlap', () => {
      const start = new Date('2026-03-01T09:00:00Z');
      const end = new Date('2026-03-01T13:00:00Z');
      const events = [makeEvent()];
      const freezes = [makeFreeze()];

      const overlaps = service.detectOverlaps(start, end, events);
      const freezeConflicts = service.detectFreezeConflicts(freezes);
      const all = [...freezeConflicts, ...overlaps];

      expect(all).toHaveLength(2);
      expect(all[0].conflictType).toBe(ConflictType.FREEZE_WINDOW);
      expect(all[1].conflictType).toBe(ConflictType.OVERLAP);
    });
  });
});
