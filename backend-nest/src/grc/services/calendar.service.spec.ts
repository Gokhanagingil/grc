import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { BcmExercise } from '../entities/bcm-exercise.entity';
import { GrcCapa } from '../entities/grc-capa.entity';
import { GrcCapaTask } from '../entities/grc-capa-task.entity';
import { CalendarEventSourceType } from '../enums';

describe('CalendarService', () => {
  let service: CalendarService;
  let bcmExerciseRepository: jest.Mocked<Repository<BcmExercise>>;
  let capaRepository: jest.Mocked<Repository<GrcCapa>>;
  let capaTaskRepository: jest.Mocked<Repository<GrcCapaTask>>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';

  const createMockQueryBuilder = (results: unknown[] = []) => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(results),
  });

  beforeEach(async () => {
    const mockBcmExerciseRepository = {
      createQueryBuilder: jest.fn(),
    };

    const mockCapaRepository = {
      createQueryBuilder: jest.fn(),
    };

    const mockCapaTaskRepository = {
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        {
          provide: getRepositoryToken(BcmExercise),
          useValue: mockBcmExerciseRepository,
        },
        {
          provide: getRepositoryToken(GrcCapa),
          useValue: mockCapaRepository,
        },
        {
          provide: getRepositoryToken(GrcCapaTask),
          useValue: mockCapaTaskRepository,
        },
      ],
    }).compile();

    service = module.get<CalendarService>(CalendarService);
    bcmExerciseRepository = module.get(getRepositoryToken(BcmExercise));
    capaRepository = module.get(getRepositoryToken(GrcCapa));
    capaTaskRepository = module.get(getRepositoryToken(GrcCapaTask));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getEvents', () => {
    it('should throw BadRequestException for invalid start date', async () => {
      await expect(
        service.getEvents({
          tenantId: mockTenantId,
          start: 'invalid-date',
          end: '2026-01-31T00:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid end date', async () => {
      await expect(
        service.getEvents({
          tenantId: mockTenantId,
          start: '2026-01-01T00:00:00.000Z',
          end: 'invalid-date',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when date range exceeds 366 days', async () => {
      await expect(
        service.getEvents({
          tenantId: mockTenantId,
          start: '2026-01-01T00:00:00.000Z',
          end: '2028-01-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when end date is before start date', async () => {
      await expect(
        service.getEvents({
          tenantId: mockTenantId,
          start: '2026-01-31T00:00:00.000Z',
          end: '2026-01-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return empty array when no events exist', async () => {
      bcmExerciseRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder([]) as never,
      );
      capaRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder([]) as never,
      );
      capaTaskRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder([]) as never,
      );

      const result = await service.getEvents({
        tenantId: mockTenantId,
        start: '2026-01-01T00:00:00.000Z',
        end: '2026-01-31T00:00:00.000Z',
      });

      expect(result).toEqual([]);
    });
  });

  describe('getCapaTaskEvents - date handling', () => {
    beforeEach(() => {
      bcmExerciseRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder([]) as never,
      );
      capaRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder([]) as never,
      );
    });

    it('should handle CAPA task with Date object dueDate', async () => {
      const mockTask = {
        id: 'task-1',
        tenantId: mockTenantId,
        capaId: 'capa-1',
        title: 'Test Task',
        dueDate: new Date('2026-01-15T00:00:00.000Z'),
        status: 'pending',
        assigneeUserId: 'user-1',
        isDeleted: false,
      };

      capaTaskRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder([mockTask]) as never,
      );

      const result = await service.getEvents({
        tenantId: mockTenantId,
        start: '2026-01-01T00:00:00.000Z',
        end: '2026-01-31T00:00:00.000Z',
        types: [CalendarEventSourceType.CAPA_TASK],
      });

      expect(result).toHaveLength(1);
      expect(result[0].startAt).toBe('2026-01-15T00:00:00.000Z');
      expect(result[0].sourceType).toBe(CalendarEventSourceType.CAPA_TASK);
    });

    it('should handle CAPA task with valid ISO string dueDate', async () => {
      const mockTask = {
        id: 'task-1',
        tenantId: mockTenantId,
        capaId: 'capa-1',
        title: 'Test Task',
        dueDate: '2026-01-15T00:00:00.000Z',
        status: 'pending',
        assigneeUserId: 'user-1',
        isDeleted: false,
      };

      capaTaskRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder([mockTask]) as never,
      );

      const result = await service.getEvents({
        tenantId: mockTenantId,
        start: '2026-01-01T00:00:00.000Z',
        end: '2026-01-31T00:00:00.000Z',
        types: [CalendarEventSourceType.CAPA_TASK],
      });

      expect(result).toHaveLength(1);
      expect(result[0].startAt).toBe('2026-01-15T00:00:00.000Z');
    });

    it('should skip CAPA task with invalid dueDate string', async () => {
      const mockTask = {
        id: 'task-1',
        tenantId: mockTenantId,
        capaId: 'capa-1',
        title: 'Test Task',
        dueDate: 'not-a-valid-date',
        status: 'pending',
        assigneeUserId: 'user-1',
        isDeleted: false,
      };

      capaTaskRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder([mockTask]) as never,
      );

      const result = await service.getEvents({
        tenantId: mockTenantId,
        start: '2026-01-01T00:00:00.000Z',
        end: '2026-01-31T00:00:00.000Z',
        types: [CalendarEventSourceType.CAPA_TASK],
      });

      expect(result).toHaveLength(0);
    });

    it('should skip CAPA task with null dueDate', async () => {
      const mockTask = {
        id: 'task-1',
        tenantId: mockTenantId,
        capaId: 'capa-1',
        title: 'Test Task',
        dueDate: null,
        status: 'pending',
        assigneeUserId: 'user-1',
        isDeleted: false,
      };

      capaTaskRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder([mockTask]) as never,
      );

      const result = await service.getEvents({
        tenantId: mockTenantId,
        start: '2026-01-01T00:00:00.000Z',
        end: '2026-01-31T00:00:00.000Z',
        types: [CalendarEventSourceType.CAPA_TASK],
      });

      expect(result).toHaveLength(0);
    });

    it('should not throw when processing mixed valid and invalid dueDate tasks', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          tenantId: mockTenantId,
          capaId: 'capa-1',
          title: 'Valid Task',
          dueDate: new Date('2026-01-15T00:00:00.000Z'),
          status: 'pending',
          assigneeUserId: 'user-1',
          isDeleted: false,
        },
        {
          id: 'task-2',
          tenantId: mockTenantId,
          capaId: 'capa-1',
          title: 'Invalid Task',
          dueDate: 'invalid-date',
          status: 'pending',
          assigneeUserId: 'user-1',
          isDeleted: false,
        },
        {
          id: 'task-3',
          tenantId: mockTenantId,
          capaId: 'capa-1',
          title: 'Another Valid Task',
          dueDate: '2026-01-20T00:00:00.000Z',
          status: 'pending',
          assigneeUserId: 'user-1',
          isDeleted: false,
        },
      ];

      capaTaskRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder(mockTasks) as never,
      );

      const result = await service.getEvents({
        tenantId: mockTenantId,
        start: '2026-01-01T00:00:00.000Z',
        end: '2026-01-31T00:00:00.000Z',
        types: [CalendarEventSourceType.CAPA_TASK],
      });

      expect(result).toHaveLength(2);
      expect(result[0].sourceId).toBe('task-1');
      expect(result[1].sourceId).toBe('task-3');
    });
  });

  describe('getCapaEvents - date handling', () => {
    beforeEach(() => {
      bcmExerciseRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder([]) as never,
      );
      capaTaskRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder([]) as never,
      );
    });

    it('should handle CAPA with Date object dueDate', async () => {
      const mockCapa = {
        id: 'capa-1',
        tenantId: mockTenantId,
        title: 'Test CAPA',
        dueDate: new Date('2026-01-15T00:00:00.000Z'),
        status: 'planned',
        priority: 'high',
        ownerUserId: 'user-1',
        type: 'corrective',
        issueId: 'issue-1',
        isDeleted: false,
      };

      capaRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder([mockCapa]) as never,
      );

      const result = await service.getEvents({
        tenantId: mockTenantId,
        start: '2026-01-01T00:00:00.000Z',
        end: '2026-01-31T00:00:00.000Z',
        types: [CalendarEventSourceType.CAPA],
      });

      expect(result).toHaveLength(1);
      expect(result[0].startAt).toBe('2026-01-15T00:00:00.000Z');
      expect(result[0].sourceType).toBe(CalendarEventSourceType.CAPA);
    });

    it('should handle CAPA with valid ISO string dueDate', async () => {
      const mockCapa = {
        id: 'capa-1',
        tenantId: mockTenantId,
        title: 'Test CAPA',
        dueDate: '2026-01-15T00:00:00.000Z',
        status: 'planned',
        priority: 'high',
        ownerUserId: 'user-1',
        type: 'corrective',
        issueId: 'issue-1',
        isDeleted: false,
      };

      capaRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder([mockCapa]) as never,
      );

      const result = await service.getEvents({
        tenantId: mockTenantId,
        start: '2026-01-01T00:00:00.000Z',
        end: '2026-01-31T00:00:00.000Z',
        types: [CalendarEventSourceType.CAPA],
      });

      expect(result).toHaveLength(1);
      expect(result[0].startAt).toBe('2026-01-15T00:00:00.000Z');
    });

    it('should skip CAPA with invalid dueDate', async () => {
      const mockCapa = {
        id: 'capa-1',
        tenantId: mockTenantId,
        title: 'Test CAPA',
        dueDate: 'invalid-date',
        status: 'planned',
        priority: 'high',
        ownerUserId: 'user-1',
        type: 'corrective',
        issueId: 'issue-1',
        isDeleted: false,
      };

      capaRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder([mockCapa]) as never,
      );

      const result = await service.getEvents({
        tenantId: mockTenantId,
        start: '2026-01-01T00:00:00.000Z',
        end: '2026-01-31T00:00:00.000Z',
        types: [CalendarEventSourceType.CAPA],
      });

      expect(result).toHaveLength(0);
    });
  });

  describe('getBcmExerciseEvents - date handling', () => {
    beforeEach(() => {
      capaRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder([]) as never,
      );
      capaTaskRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder([]) as never,
      );
    });

    it('should handle BCM exercise with Date object scheduledAt', async () => {
      const mockExercise = {
        id: 'exercise-1',
        tenantId: mockTenantId,
        name: 'Test Exercise',
        scheduledAt: new Date('2026-01-15T00:00:00.000Z'),
        completedAt: null,
        status: 'SCHEDULED',
        exerciseType: 'tabletop',
        outcome: null,
        serviceId: 'service-1',
        isDeleted: false,
      };

      bcmExerciseRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder([mockExercise]) as never,
      );

      const result = await service.getEvents({
        tenantId: mockTenantId,
        start: '2026-01-01T00:00:00.000Z',
        end: '2026-01-31T00:00:00.000Z',
        types: [CalendarEventSourceType.BCM_EXERCISE],
      });

      expect(result).toHaveLength(1);
      expect(result[0].startAt).toBe('2026-01-15T00:00:00.000Z');
      expect(result[0].sourceType).toBe(CalendarEventSourceType.BCM_EXERCISE);
    });

    it('should handle BCM exercise with valid ISO string scheduledAt', async () => {
      const mockExercise = {
        id: 'exercise-1',
        tenantId: mockTenantId,
        name: 'Test Exercise',
        scheduledAt: '2026-01-15T00:00:00.000Z',
        completedAt: null,
        status: 'SCHEDULED',
        exerciseType: 'tabletop',
        outcome: null,
        serviceId: 'service-1',
        isDeleted: false,
      };

      bcmExerciseRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder([mockExercise]) as never,
      );

      const result = await service.getEvents({
        tenantId: mockTenantId,
        start: '2026-01-01T00:00:00.000Z',
        end: '2026-01-31T00:00:00.000Z',
        types: [CalendarEventSourceType.BCM_EXERCISE],
      });

      expect(result).toHaveLength(1);
      expect(result[0].startAt).toBe('2026-01-15T00:00:00.000Z');
    });

    it('should skip BCM exercise with invalid scheduledAt', async () => {
      const mockExercise = {
        id: 'exercise-1',
        tenantId: mockTenantId,
        name: 'Test Exercise',
        scheduledAt: 'invalid-date',
        completedAt: null,
        status: 'SCHEDULED',
        exerciseType: 'tabletop',
        outcome: null,
        serviceId: 'service-1',
        isDeleted: false,
      };

      bcmExerciseRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder([mockExercise]) as never,
      );

      const result = await service.getEvents({
        tenantId: mockTenantId,
        start: '2026-01-01T00:00:00.000Z',
        end: '2026-01-31T00:00:00.000Z',
        types: [CalendarEventSourceType.BCM_EXERCISE],
      });

      expect(result).toHaveLength(0);
    });

    it('should handle BCM exercise with completedAt as string', async () => {
      const mockExercise = {
        id: 'exercise-1',
        tenantId: mockTenantId,
        name: 'Test Exercise',
        scheduledAt: new Date('2026-01-15T00:00:00.000Z'),
        completedAt: '2026-01-16T00:00:00.000Z',
        status: 'COMPLETED',
        exerciseType: 'tabletop',
        outcome: 'success',
        serviceId: 'service-1',
        isDeleted: false,
      };

      bcmExerciseRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder([mockExercise]) as never,
      );

      const result = await service.getEvents({
        tenantId: mockTenantId,
        start: '2026-01-01T00:00:00.000Z',
        end: '2026-01-31T00:00:00.000Z',
        types: [CalendarEventSourceType.BCM_EXERCISE],
      });

      expect(result).toHaveLength(1);
      expect(result[0].endAt).toBe('2026-01-16T00:00:00.000Z');
    });
  });

  describe('event sorting', () => {
    it('should sort events by startAt date', async () => {
      const mockTasks = [
        {
          id: 'task-3',
          tenantId: mockTenantId,
          capaId: 'capa-1',
          title: 'Task 3',
          dueDate: new Date('2026-01-25T00:00:00.000Z'),
          status: 'pending',
          assigneeUserId: 'user-1',
          isDeleted: false,
        },
        {
          id: 'task-1',
          tenantId: mockTenantId,
          capaId: 'capa-1',
          title: 'Task 1',
          dueDate: new Date('2026-01-05T00:00:00.000Z'),
          status: 'pending',
          assigneeUserId: 'user-1',
          isDeleted: false,
        },
        {
          id: 'task-2',
          tenantId: mockTenantId,
          capaId: 'capa-1',
          title: 'Task 2',
          dueDate: new Date('2026-01-15T00:00:00.000Z'),
          status: 'pending',
          assigneeUserId: 'user-1',
          isDeleted: false,
        },
      ];

      bcmExerciseRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder([]) as never,
      );
      capaRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder([]) as never,
      );
      capaTaskRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder(mockTasks) as never,
      );

      const result = await service.getEvents({
        tenantId: mockTenantId,
        start: '2026-01-01T00:00:00.000Z',
        end: '2026-01-31T00:00:00.000Z',
        types: [CalendarEventSourceType.CAPA_TASK],
      });

      expect(result).toHaveLength(3);
      expect(result[0].sourceId).toBe('task-1');
      expect(result[1].sourceId).toBe('task-2');
      expect(result[2].sourceId).toBe('task-3');
    });
  });
});
