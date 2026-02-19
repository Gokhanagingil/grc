import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SlaService } from './sla.service';
import { SlaEngineService } from './sla-engine.service';
import { SlaDefinition, SlaMetric, SlaSchedule } from './sla-definition.entity';
import { SlaInstance, SlaInstanceStatus } from './sla-instance.entity';
import { AuditService } from '../../audit/audit.service';
import { RuntimeLoggerService } from '../diagnostics/runtime-logger.service';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';

const mockDefinition: SlaDefinition = {
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
  priorityFilter: ['p1'],
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
};

describe('SlaService', () => {
  let service: SlaService;
  let defRepo: jest.Mocked<Repository<SlaDefinition>>;
  let instRepo: jest.Mocked<Repository<SlaInstance>>;

  beforeEach(async () => {
    const mockDefRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      merge: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockInstRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlaService,
        SlaEngineService,
        {
          provide: getRepositoryToken(SlaDefinition),
          useValue: mockDefRepo,
        },
        {
          provide: getRepositoryToken(SlaInstance),
          useValue: mockInstRepo,
        },
        {
          provide: RuntimeLoggerService,
          useValue: {
            logSlaEvent: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            recordCreate: jest.fn(),
            recordUpdate: jest.fn(),
            recordDelete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SlaService>(SlaService);
    defRepo = module.get(getRepositoryToken(SlaDefinition));
    instRepo = module.get(getRepositoryToken(SlaInstance));
  });

  describe('createDefinition', () => {
    it('should create an SLA definition', async () => {
      const created = { ...mockDefinition };
      defRepo.create.mockReturnValue(created);
      defRepo.save.mockResolvedValue(created);

      const result = await service.createDefinition(TENANT_ID, USER_ID, {
        name: 'P1 Resolution',
        targetSeconds: 3600,
      });

      expect(result).toBeDefined();
      expect(defRepo.create).toHaveBeenCalled();
      expect(defRepo.save).toHaveBeenCalled();
    });
  });

  describe('findDefinitionById', () => {
    it('should find a definition by ID', async () => {
      defRepo.findOne.mockResolvedValue(mockDefinition);

      const result = await service.findDefinitionById(TENANT_ID, 'def-1');
      expect(result).toEqual(mockDefinition);
      expect(defRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'def-1', tenantId: TENANT_ID, isDeleted: false },
      });
    });

    it('should return null when not found', async () => {
      defRepo.findOne.mockResolvedValue(null);

      const result = await service.findDefinitionById(TENANT_ID, 'def-999');
      expect(result).toBeNull();
    });
  });

  describe('softDeleteDefinition', () => {
    it('should soft delete a definition', async () => {
      defRepo.findOne.mockResolvedValueOnce(mockDefinition);
      defRepo.findOne.mockResolvedValueOnce(mockDefinition);
      defRepo.merge.mockReturnValue({
        ...mockDefinition,
        isDeleted: true,
      } as SlaDefinition);
      defRepo.save.mockResolvedValue({
        ...mockDefinition,
        isDeleted: true,
      } as SlaDefinition);

      const result = await service.softDeleteDefinition(
        TENANT_ID,
        USER_ID,
        'def-1',
      );
      expect(result).toBe(true);
    });

    it('should return false when definition not found', async () => {
      defRepo.findOne.mockResolvedValue(null);

      const result = await service.softDeleteDefinition(
        TENANT_ID,
        USER_ID,
        'def-999',
      );
      expect(result).toBe(false);
    });
  });

  describe('startSlaForRecord', () => {
    it('should start SLAs matching priority filter', async () => {
      defRepo.find.mockResolvedValue([mockDefinition]);
      instRepo.findOne.mockResolvedValue(null);
      const newInstance = {
        id: 'inst-1',
        tenantId: TENANT_ID,
        recordType: 'ItsmIncident',
        recordId: 'inc-1',
        definitionId: 'def-1',
        startAt: expect.any(Date),
        dueAt: expect.any(Date),
        breached: false,
        status: SlaInstanceStatus.IN_PROGRESS,
      };
      instRepo.create.mockReturnValue(newInstance as unknown as SlaInstance);
      instRepo.save.mockResolvedValue(newInstance as unknown as SlaInstance);

      const result = await service.startSlaForRecord(
        TENANT_ID,
        'ItsmIncident',
        'inc-1',
        'p1',
        undefined,
      );

      expect(result).toHaveLength(1);
      expect(instRepo.create).toHaveBeenCalled();
      expect(instRepo.save).toHaveBeenCalled();
    });

    it('should not start SLA when priority does not match', async () => {
      defRepo.find.mockResolvedValue([mockDefinition]);

      const result = await service.startSlaForRecord(
        TENANT_ID,
        'ItsmIncident',
        'inc-1',
        'p4',
        undefined,
      );

      expect(result).toHaveLength(0);
      expect(instRepo.create).not.toHaveBeenCalled();
    });

    it('should not create duplicate instances', async () => {
      defRepo.find.mockResolvedValue([mockDefinition]);
      instRepo.findOne.mockResolvedValue({
        id: 'existing-inst',
      } as SlaInstance);

      const result = await service.startSlaForRecord(
        TENANT_ID,
        'ItsmIncident',
        'inc-1',
        'p1',
        undefined,
      );

      expect(result).toHaveLength(0);
      expect(instRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('evaluateOnStateChange', () => {
    it('should stop SLA when state matches stop condition', async () => {
      const activeInstance = {
        id: 'inst-1',
        tenantId: TENANT_ID,
        recordType: 'ItsmIncident',
        recordId: 'inc-1',
        definitionId: 'def-1',
        definition: mockDefinition,
        startAt: new Date('2026-01-15T10:00:00Z'),
        dueAt: new Date('2026-01-15T11:00:00Z'),
        stopAt: null,
        pauseAt: null,
        pausedDurationSeconds: 0,
        breached: false,
        elapsedSeconds: 0,
        remainingSeconds: 3600,
        status: SlaInstanceStatus.IN_PROGRESS,
      } as unknown as SlaInstance;

      instRepo.find.mockResolvedValue([activeInstance]);
      instRepo.save.mockImplementation((inst) =>
        Promise.resolve(inst as SlaInstance),
      );

      const now = new Date('2026-01-15T10:30:00Z');
      const result = await service.evaluateOnStateChange(
        TENANT_ID,
        'ItsmIncident',
        'inc-1',
        'resolved',
        now,
      );

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(SlaInstanceStatus.MET);
      expect(result[0].stopAt).toBeDefined();
    });

    it('should pause SLA when state matches pause condition', async () => {
      const defWithPause = {
        ...mockDefinition,
        pauseOnStates: ['on_hold'],
      };
      const activeInstance = {
        id: 'inst-1',
        tenantId: TENANT_ID,
        definition: defWithPause,
        startAt: new Date('2026-01-15T10:00:00Z'),
        pauseAt: null,
        pausedDurationSeconds: 0,
        status: SlaInstanceStatus.IN_PROGRESS,
      } as unknown as SlaInstance;

      instRepo.find.mockResolvedValue([activeInstance]);
      instRepo.save.mockImplementation((inst) =>
        Promise.resolve(inst as SlaInstance),
      );

      const result = await service.evaluateOnStateChange(
        TENANT_ID,
        'ItsmIncident',
        'inc-1',
        'on_hold',
      );

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(SlaInstanceStatus.PAUSED);
      expect(result[0].pauseAt).toBeDefined();
    });

    it('should resume paused SLA on non-pause/non-stop state', async () => {
      const defWithPause = {
        ...mockDefinition,
        pauseOnStates: ['on_hold'],
      };
      const pausedInstance = {
        id: 'inst-1',
        tenantId: TENANT_ID,
        definition: defWithPause,
        startAt: new Date('2026-01-15T10:00:00Z'),
        dueAt: new Date('2026-01-15T11:00:00Z'),
        stopAt: null,
        pauseAt: new Date('2026-01-15T10:30:00Z'),
        pausedDurationSeconds: 0,
        breached: false,
        elapsedSeconds: 0,
        remainingSeconds: 3600,
        status: SlaInstanceStatus.PAUSED,
      } as unknown as SlaInstance;

      instRepo.find.mockResolvedValue([pausedInstance]);
      instRepo.save.mockImplementation((inst) =>
        Promise.resolve(inst as SlaInstance),
      );

      const now = new Date('2026-01-15T10:45:00Z');
      const result = await service.evaluateOnStateChange(
        TENANT_ID,
        'ItsmIncident',
        'inc-1',
        'in_progress',
        now,
      );

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(SlaInstanceStatus.IN_PROGRESS);
      expect(result[0].pauseAt).toBeNull();
      expect(result[0].pausedDurationSeconds).toBe(900);
    });
  });

  describe('getInstancesForRecord', () => {
    it('should return instances for a record', async () => {
      const instances = [{ id: 'inst-1', recordId: 'inc-1' } as SlaInstance];
      instRepo.find.mockResolvedValue(instances);

      const result = await service.getInstancesForRecord(
        TENANT_ID,
        'ItsmIncident',
        'inc-1',
      );
      expect(result).toEqual(instances);
      expect(instRepo.find).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          recordType: 'ItsmIncident',
          recordId: 'inc-1',
          isDeleted: false,
        },
        relations: ['definition'],
        order: { createdAt: 'DESC' },
      });
    });
  });
});
