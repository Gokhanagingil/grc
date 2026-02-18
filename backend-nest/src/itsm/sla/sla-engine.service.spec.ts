import { SlaEngineService } from './sla-engine.service';
import { SlaDefinition, SlaMetric, SlaSchedule } from './sla-definition.entity';

describe('SlaEngineService', () => {
  let engine: SlaEngineService;

  beforeEach(() => {
    engine = new SlaEngineService();
  });

  const makeDefinition = (
    overrides: Partial<SlaDefinition> = {},
  ): SlaDefinition => {
    return {
      id: 'def-1',
      tenantId: 'tenant-1',
      name: 'Test SLA',
      description: null,
      metric: SlaMetric.RESOLUTION_TIME,
      targetSeconds: 3600,
      schedule: SlaSchedule.TWENTY_FOUR_SEVEN,
      businessStartHour: 9,
      businessEndHour: 17,
      businessDays: [1, 2, 3, 4, 5],
      priorityFilter: null,
      serviceIdFilter: null,
      stopOnStates: ['resolved', 'closed'],
      pauseOnStates: null,
      isActive: true,
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null,
      isDeleted: false,
      tenant: {} as never,
      ...overrides,
    } as SlaDefinition;
  };

  describe('computeDueAt', () => {
    it('should compute due date for 24x7 schedule', () => {
      const def = makeDefinition({ targetSeconds: 3600 });
      const start = new Date('2026-01-15T10:00:00Z');
      const due = engine.computeDueAt(def, start);
      expect(due.getTime()).toBe(new Date('2026-01-15T11:00:00Z').getTime());
    });

    it('should compute due date for business hours schedule', () => {
      const def = makeDefinition({
        schedule: SlaSchedule.BUSINESS_HOURS,
        targetSeconds: 8 * 3600,
        businessStartHour: 9,
        businessEndHour: 17,
        businessDays: [1, 2, 3, 4, 5],
      });
      const start = new Date('2026-01-15T09:00:00Z');
      const due = engine.computeDueAt(def, start);
      expect(due.getTime()).toBe(new Date('2026-01-15T17:00:00Z').getTime());
    });

    it('should span multiple business days when needed', () => {
      const def = makeDefinition({
        schedule: SlaSchedule.BUSINESS_HOURS,
        targetSeconds: 12 * 3600,
        businessStartHour: 9,
        businessEndHour: 17,
        businessDays: [1, 2, 3, 4, 5],
      });
      const start = new Date('2026-01-15T09:00:00Z');
      const due = engine.computeDueAt(def, start);
      expect(due.getTime()).toBe(new Date('2026-01-16T13:00:00Z').getTime());
    });

    it('should skip weekends', () => {
      const def = makeDefinition({
        schedule: SlaSchedule.BUSINESS_HOURS,
        targetSeconds: 8 * 3600,
        businessStartHour: 9,
        businessEndHour: 17,
        businessDays: [1, 2, 3, 4, 5],
      });
      const start = new Date('2026-01-16T15:00:00Z');
      const due = engine.computeDueAt(def, start);
      expect(due.getTime()).toBe(new Date('2026-01-19T15:00:00Z').getTime());
    });
  });

  describe('computeElapsedSeconds', () => {
    it('should compute elapsed for 24x7', () => {
      const def = makeDefinition();
      const start = new Date('2026-01-15T10:00:00Z');
      const end = new Date('2026-01-15T10:30:00Z');
      expect(engine.computeElapsedSeconds(def, start, end, 0)).toBe(1800);
    });

    it('should subtract paused duration', () => {
      const def = makeDefinition();
      const start = new Date('2026-01-15T10:00:00Z');
      const end = new Date('2026-01-15T11:00:00Z');
      expect(engine.computeElapsedSeconds(def, start, end, 600)).toBe(3000);
    });
  });

  describe('computeRemainingSeconds', () => {
    it('should return remaining time', () => {
      const def = makeDefinition({ targetSeconds: 3600 });
      expect(engine.computeRemainingSeconds(def, 1800)).toBe(1800);
    });

    it('should return 0 when breached', () => {
      const def = makeDefinition({ targetSeconds: 3600 });
      expect(engine.computeRemainingSeconds(def, 4000)).toBe(0);
    });
  });

  describe('isBreached', () => {
    it('should return false when within target', () => {
      const def = makeDefinition({ targetSeconds: 3600 });
      expect(engine.isBreached(def, 1800)).toBe(false);
    });

    it('should return true when elapsed exceeds target', () => {
      const def = makeDefinition({ targetSeconds: 3600 });
      expect(engine.isBreached(def, 3601)).toBe(true);
    });

    it('should return true when elapsed equals target', () => {
      const def = makeDefinition({ targetSeconds: 3600 });
      expect(engine.isBreached(def, 3600)).toBe(true);
    });
  });

  describe('shouldApply', () => {
    it('should apply when no filters and active', () => {
      const def = makeDefinition();
      expect(engine.shouldApply(def, 'p1', undefined)).toBe(true);
    });

    it('should not apply when inactive', () => {
      const def = makeDefinition({ isActive: false });
      expect(engine.shouldApply(def, 'p1', undefined)).toBe(false);
    });

    it('should filter by priority', () => {
      const def = makeDefinition({ priorityFilter: ['p1', 'p2'] });
      expect(engine.shouldApply(def, 'p1', undefined)).toBe(true);
      expect(engine.shouldApply(def, 'p4', undefined)).toBe(false);
    });

    it('should filter by service ID', () => {
      const def = makeDefinition({ serviceIdFilter: 'svc-1' });
      expect(engine.shouldApply(def, undefined, 'svc-1')).toBe(true);
      expect(engine.shouldApply(def, undefined, 'svc-2')).toBe(false);
    });
  });

  describe('shouldStop', () => {
    it('should stop on configured states', () => {
      const def = makeDefinition({ stopOnStates: ['resolved', 'closed'] });
      expect(engine.shouldStop(def, 'resolved')).toBe(true);
      expect(engine.shouldStop(def, 'in_progress')).toBe(false);
    });
  });

  describe('shouldPause', () => {
    it('should not pause when no pause states configured', () => {
      const def = makeDefinition({ pauseOnStates: null });
      expect(engine.shouldPause(def, 'on_hold')).toBe(false);
    });

    it('should pause on configured states', () => {
      const def = makeDefinition({ pauseOnStates: ['on_hold'] });
      expect(engine.shouldPause(def, 'on_hold')).toBe(true);
      expect(engine.shouldPause(def, 'in_progress')).toBe(false);
    });
  });
});
