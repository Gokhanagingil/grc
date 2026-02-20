import { CmdbSchedulerService } from '../cmdb-scheduler.service';
import {
  CmdbImportSource,
  ImportSourceType,
} from '../cmdb-import-source.entity';
import { CmdbImportJob, ImportJobStatus } from '../cmdb-import-job.entity';
import { Repository } from 'typeorm';
import { EventBusService } from '../../../../event-bus/event-bus.service';

describe('CmdbSchedulerService', () => {
  let service: CmdbSchedulerService;
  let sourceFind: jest.Mock;
  let sourceUpdate: jest.Mock;
  let jobCreate: jest.Mock;
  let jobSave: jest.Mock;
  let jobFindOne: jest.Mock;
  let eventEmit: jest.Mock;

  const tenantId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    sourceFind = jest.fn().mockResolvedValue([]);
    sourceUpdate = jest.fn().mockResolvedValue({ affected: 1 });

    jobCreate = jest.fn().mockImplementation((data) => ({
      id: 'job-1',
      ...data,
    }));
    jobSave = jest.fn().mockImplementation((data) => ({
      id: 'job-1',
      ...data,
    }));
    jobFindOne = jest.fn().mockResolvedValue(null);

    eventEmit = jest.fn().mockResolvedValue(undefined);

    const sourceRepo = {
      find: sourceFind,
      update: sourceUpdate,
      findOne: jest.fn(),
    };

    const jobRepo = {
      create: jobCreate,
      save: jobSave,
      findOne: jobFindOne,
    };

    const eventBus = {
      emit: eventEmit,
    };

    service = new CmdbSchedulerService(
      sourceRepo as unknown as Repository<CmdbImportSource>,
      jobRepo as unknown as Repository<CmdbImportJob>,
      eventBus as unknown as EventBusService,
    );
  });

  describe('processDueSources', () => {
    it('returns 0 when no sources are due', async () => {
      sourceFind.mockResolvedValue([]);
      const count = await service.processDueSources();
      expect(count).toBe(0);
    });

    it('triggers a run for a due source', async () => {
      const source = createSource({
        id: 'src-1',
        scheduleEnabled: true,
        enabled: true,
        cronExpr: '*/5 * * * *',
        nextRunAt: new Date(Date.now() - 60000),
        runCountToday: 0,
        maxRunsPerDay: 24,
        runCountResetDate: new Date().toISOString().slice(0, 10),
      });

      sourceFind.mockResolvedValue([source]);

      const count = await service.processDueSources();
      expect(count).toBe(1);
      expect(jobSave).toHaveBeenCalled();
      expect(eventEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'import.job.started',
        }),
      );
    });
  });

  describe('triggerSourceRun - locking', () => {
    it('skips when a PENDING job already exists', async () => {
      const source = createSource({
        id: 'src-2',
        runCountToday: 0,
        maxRunsPerDay: 24,
        runCountResetDate: new Date().toISOString().slice(0, 10),
      });

      jobFindOne.mockResolvedValueOnce({
        id: 'existing-job',
        status: ImportJobStatus.PENDING,
      } as CmdbImportJob);

      const todayStr = new Date().toISOString().slice(0, 10);
      const result = await service.triggerSourceRun(source, todayStr);
      expect(result).toBeNull();
      expect(jobSave).not.toHaveBeenCalled();
    });

    it('skips when maxRunsPerDay is reached', async () => {
      const source = createSource({
        id: 'src-3',
        runCountToday: 24,
        maxRunsPerDay: 24,
        runCountResetDate: new Date().toISOString().slice(0, 10),
      });

      const todayStr = new Date().toISOString().slice(0, 10);
      const result = await service.triggerSourceRun(source, todayStr);
      expect(result).toBeNull();
      expect(jobSave).not.toHaveBeenCalled();
    });

    it('resets run count when date changes', async () => {
      const source = createSource({
        id: 'src-4',
        runCountToday: 10,
        maxRunsPerDay: 24,
        runCountResetDate: '2024-01-01',
      });

      const todayStr = new Date().toISOString().slice(0, 10);
      const result = await service.triggerSourceRun(source, todayStr);
      expect(result).not.toBeNull();
      expect(sourceUpdate).toHaveBeenCalledWith(
        'src-4',
        expect.objectContaining({ runCountToday: 0 }),
      );
    });
  });

  describe('computeNextRun', () => {
    it('returns null for invalid cron', () => {
      const source = createSource({ cronExpr: 'invalid' });
      expect(service.computeNextRun(source)).toBeNull();
    });

    it('returns null when no cron expression', () => {
      const source = createSource({ cronExpr: null });
      expect(service.computeNextRun(source)).toBeNull();
    });

    it('returns a future date for valid cron', () => {
      const source = createSource({ cronExpr: '*/5 * * * *' });
      const next = service.computeNextRun(source);
      expect(next).toBeInstanceOf(Date);
      expect(next!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('event emissions', () => {
    it('emits import.job.finished', async () => {
      const job = {
        id: 'job-1',
        sourceId: 'src-1',
        status: ImportJobStatus.COMPLETED,
        totalRows: 100,
        createdCount: 50,
        updatedCount: 30,
        conflictCount: 10,
        errorCount: 10,
      } as CmdbImportJob;

      await service.emitJobFinished(tenantId, job, 5000);
      expect(eventEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'import.job.finished',
          payload: expect.objectContaining({
            jobId: 'job-1',
            durationMs: 5000,
          }),
        }),
      );
    });

    it('emits import.job.failed', async () => {
      await service.emitJobFailed(tenantId, 'job-2', 'Connection refused');
      expect(eventEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'import.job.failed',
          payload: expect.objectContaining({
            jobId: 'job-2',
            error: 'Connection refused',
          }),
        }),
      );
    });
  });

  describe('tick - concurrency guard', () => {
    it('skips tick when already processing', async () => {
      sourceFind.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 100));
        return [];
      });

      const p1 = service.tick();
      const p2 = service.tick();
      await Promise.all([p1, p2]);

      expect(sourceFind).toHaveBeenCalledTimes(1);
    });
  });

  function createSource(
    overrides: Partial<CmdbImportSource> & { cronExpr?: string | null } = {},
  ): CmdbImportSource {
    return {
      id: 'src-default',
      tenantId,
      name: 'Test Source',
      type: ImportSourceType.JSON,
      config: null,
      enabled: true,
      scheduleEnabled: true,
      cronExpr: '*/5 * * * *',
      timezone: 'UTC',
      maxRunsPerDay: 24,
      dryRunByDefault: true,
      lastRunAt: null,
      nextRunAt: new Date(Date.now() - 60000),
      runCountToday: 0,
      runCountResetDate: new Date().toISOString().slice(0, 10),
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null,
      tenant: null as never,
      ...overrides,
    } as CmdbImportSource;
  }
});
