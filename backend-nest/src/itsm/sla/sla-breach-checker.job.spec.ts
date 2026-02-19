import { SlaBreachCheckerJob } from './sla-breach-checker.job';
import { SlaEngineService } from './sla-engine.service';
import { SlaInstance, SlaInstanceStatus } from './sla-instance.entity';
import { SlaDefinition, SlaMetric, SlaSchedule } from './sla-definition.entity';
import { JobStatus } from '../../jobs/interfaces/job.interface';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const makeDefinition = (
  overrides: Partial<SlaDefinition> = {},
): SlaDefinition =>
  ({
    id: 'def-1',
    tenantId: TENANT_ID,
    name: 'P1 Resolution',
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
  }) as SlaDefinition;

describe('SlaBreachCheckerJob', () => {
  let job: SlaBreachCheckerJob;
  let engine: SlaEngineService;
  let mockInstanceRepo: {
    find: jest.Mock;
    save: jest.Mock;
  };
  let mockTenantsService: {
    findAll: jest.Mock;
  };
  let mockRuntimeLogger: {
    logSlaEvent: jest.Mock;
  };

  beforeEach(() => {
    engine = new SlaEngineService();
    mockInstanceRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation((inst) => Promise.resolve(inst)),
    };
    mockTenantsService = {
      findAll: jest
        .fn()
        .mockResolvedValue([{ id: TENANT_ID, name: 'Demo', isActive: true }]),
    };
    mockRuntimeLogger = {
      logSlaEvent: jest.fn(),
    };

    job = new SlaBreachCheckerJob(
      mockInstanceRepo as never,
      mockTenantsService as never,
      engine,
      mockRuntimeLogger as never,
    );
  });

  it('should have correct job config', () => {
    expect(job.config.name).toBe('sla-breach-checker');
    expect(job.config.enabled).toBe(true);
    expect(job.config.scheduleIntervalMs).toBe(60000);
  });

  it('should return success when no active instances', async () => {
    const result = await job.execute();
    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(result.summary).toContain('Checked 0');
  });

  it('should detect and mark breached instances', async () => {
    const def = makeDefinition({ targetSeconds: 3600 });
    const instance = {
      id: 'inst-1',
      tenantId: TENANT_ID,
      recordType: 'ItsmIncident',
      recordId: 'inc-1',
      definitionId: 'def-1',
      definition: def,
      startAt: new Date(Date.now() - 7200 * 1000),
      dueAt: new Date(Date.now() - 3600 * 1000),
      stopAt: null,
      pauseAt: null,
      pausedDurationSeconds: 0,
      breached: false,
      elapsedSeconds: 0,
      remainingSeconds: 3600,
      status: SlaInstanceStatus.IN_PROGRESS,
      isDeleted: false,
    } as unknown as SlaInstance;

    mockInstanceRepo.find.mockResolvedValue([instance]);

    const result = await job.execute();

    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(result.summary).toContain('1 newly breached');
    expect(mockInstanceRepo.save).toHaveBeenCalled();
    const saved = mockInstanceRepo.save.mock.calls[0][0];
    expect(saved.breached).toBe(true);
    expect(saved.status).toBe(SlaInstanceStatus.BREACHED);
    expect(mockRuntimeLogger.logSlaEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'breached' }),
    );
  });

  it('should update elapsed/remaining for non-breached instances', async () => {
    const def = makeDefinition({ targetSeconds: 7200 });
    const instance = {
      id: 'inst-2',
      tenantId: TENANT_ID,
      recordType: 'ItsmIncident',
      recordId: 'inc-2',
      definitionId: 'def-1',
      definition: def,
      startAt: new Date(Date.now() - 1800 * 1000),
      dueAt: new Date(Date.now() + 5400 * 1000),
      stopAt: null,
      pauseAt: null,
      pausedDurationSeconds: 0,
      breached: false,
      elapsedSeconds: 0,
      remainingSeconds: 7200,
      status: SlaInstanceStatus.IN_PROGRESS,
      isDeleted: false,
    } as unknown as SlaInstance;

    mockInstanceRepo.find.mockResolvedValue([instance]);

    const result = await job.execute();

    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(result.summary).toContain('0 newly breached');
    const saved = mockInstanceRepo.save.mock.calls[0][0];
    expect(saved.breached).toBe(false);
    expect(saved.elapsedSeconds).toBeGreaterThan(0);
    expect(saved.remainingSeconds).toBeGreaterThan(0);
  });

  it('should skip inactive tenants', async () => {
    mockTenantsService.findAll.mockResolvedValue([
      { id: TENANT_ID, name: 'Demo', isActive: false },
    ]);

    const result = await job.execute();
    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(mockInstanceRepo.find).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    mockTenantsService.findAll.mockRejectedValue(new Error('DB down'));

    const result = await job.execute();
    expect(result.status).toBe(JobStatus.FAILED);
    expect(result.error?.message).toBe('DB down');
  });

  it('should process multiple tenants', async () => {
    mockTenantsService.findAll.mockResolvedValue([
      { id: 'tenant-a', name: 'A', isActive: true },
      { id: 'tenant-b', name: 'B', isActive: true },
    ]);

    const result = await job.execute();
    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(mockInstanceRepo.find).toHaveBeenCalledTimes(2);
  });
});
