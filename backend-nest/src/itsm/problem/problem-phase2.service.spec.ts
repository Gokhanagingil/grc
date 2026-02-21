import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException } from '@nestjs/common';

import { ProblemService } from './problem.service';
import { AuditService } from '../../audit/audit.service';
import { ItsmProblem } from './problem.entity';
import { ItsmProblemIncident } from './problem-incident.entity';
import { ItsmProblemChange } from './problem-change.entity';
import { ProblemState, RootCauseCategory } from '../enums';

describe('ProblemService — Phase 2 (Reopen, RCA, Recurrence)', () => {
  let service: ProblemService;
  let problemRepo: jest.Mocked<Repository<ItsmProblem>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';
  const mockUserId = '00000000-0000-0000-0000-000000000002';
  const mockProblemId = '00000000-0000-0000-0000-000000000101';

  const baseProblem: Partial<ItsmProblem> = {
    id: mockProblemId,
    tenantId: mockTenantId,
    number: 'PRB000001',
    state: ProblemState.RESOLVED,
    reopenCount: 0,
    rootCauseSummary: null,
    fiveWhySummary: null,
    contributingFactors: null,
    rootCauseCategory: null,
    detectionGap: null,
    monitoringGap: null,
    rcaCompletedAt: null,
    rcaCompletedBy: null,
    lastReopenReason: null,
    lastReopenedAt: null,
    isDeleted: false,
    resolvedAt: new Date(),
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockProblemRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      createQueryBuilder: jest.fn(),
      merge: jest.fn().mockImplementation((entity: unknown, data: unknown) => ({
        ...(entity as Record<string, unknown>),
        ...(data as Record<string, unknown>),
      })),
    };

    const mockProblemIncidentRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };

    const mockProblemChangeRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const mockAuditService = {
      recordCreate: jest.fn(),
      recordUpdate: jest.fn(),
      recordDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProblemService,
        {
          provide: getRepositoryToken(ItsmProblem),
          useValue: mockProblemRepo,
        },
        {
          provide: getRepositoryToken(ItsmProblemIncident),
          useValue: mockProblemIncidentRepo,
        },
        {
          provide: getRepositoryToken(ItsmProblemChange),
          useValue: mockProblemChangeRepo,
        },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ProblemService>(ProblemService);
    problemRepo = module.get(getRepositoryToken(ItsmProblem));
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // reopenProblem
  // ==========================================================================

  describe('reopenProblem', () => {
    it('should reopen a RESOLVED problem', async () => {
      const existing = {
        ...baseProblem,
        state: ProblemState.RESOLVED,
      } as ItsmProblem;
      problemRepo.findOne.mockResolvedValue(existing);

      // updateForTenant uses save internally via the base class
      // We mock save to return the updated entity
      problemRepo.save.mockImplementation((entity: any) =>
        Promise.resolve({
          ...existing,
          ...entity,
          state: ProblemState.UNDER_INVESTIGATION,
          reopenCount: 1,
          lastReopenReason: 'Root cause was wrong',
        }),
      );

      const result = await service.reopenProblem(
        mockTenantId,
        mockUserId,
        mockProblemId,
        'Root cause was wrong',
      );

      expect(result).not.toBeNull();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'problem.reopened',
        expect.objectContaining({
          problemId: mockProblemId,
          tenantId: mockTenantId,
          reason: 'Root cause was wrong',
          reopenCount: 1,
        }),
      );
    });

    it('should reopen a CLOSED problem', async () => {
      const existing = {
        ...baseProblem,
        state: ProblemState.CLOSED,
        closedAt: new Date(),
      } as ItsmProblem;
      problemRepo.findOne.mockResolvedValue(existing);
      problemRepo.save.mockImplementation((entity: any) =>
        Promise.resolve({
          ...existing,
          ...entity,
          state: ProblemState.UNDER_INVESTIGATION,
          reopenCount: 1,
        }),
      );

      const result = await service.reopenProblem(
        mockTenantId,
        mockUserId,
        mockProblemId,
        'New evidence found',
      );

      expect(result).not.toBeNull();
    });

    it('should reject reopen from NEW state', async () => {
      const existing = {
        ...baseProblem,
        state: ProblemState.NEW,
      } as ItsmProblem;
      problemRepo.findOne.mockResolvedValue(existing);

      await expect(
        service.reopenProblem(
          mockTenantId,
          mockUserId,
          mockProblemId,
          'reason',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject reopen from UNDER_INVESTIGATION state', async () => {
      const existing = {
        ...baseProblem,
        state: ProblemState.UNDER_INVESTIGATION,
      } as ItsmProblem;
      problemRepo.findOne.mockResolvedValue(existing);

      await expect(
        service.reopenProblem(
          mockTenantId,
          mockUserId,
          mockProblemId,
          'reason',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return null when problem not found', async () => {
      problemRepo.findOne.mockResolvedValue(null);

      const result = await service.reopenProblem(
        mockTenantId,
        mockUserId,
        'missing-id',
        'reason',
      );

      expect(result).toBeNull();
    });

    it('should increment reopenCount on repeated reopens', async () => {
      const existing = {
        ...baseProblem,
        state: ProblemState.RESOLVED,
        reopenCount: 2,
      } as ItsmProblem;
      problemRepo.findOne.mockResolvedValue(existing);
      problemRepo.save.mockImplementation((entity: any) =>
        Promise.resolve({ ...existing, ...entity }),
      );

      await service.reopenProblem(
        mockTenantId,
        mockUserId,
        mockProblemId,
        'Third reopen',
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'problem.reopened',
        expect.objectContaining({ reopenCount: 3 }),
      );
    });
  });

  // ==========================================================================
  // completeRca
  // ==========================================================================

  describe('completeRca', () => {
    it('should complete RCA with all fields', async () => {
      const existing = {
        ...baseProblem,
        state: ProblemState.UNDER_INVESTIGATION,
      } as ItsmProblem;
      problemRepo.findOne.mockResolvedValue(existing);
      problemRepo.save.mockImplementation((entity: any) =>
        Promise.resolve({ ...existing, ...entity }),
      );

      const result = await service.completeRca(
        mockTenantId,
        mockUserId,
        mockProblemId,
        {
          rootCauseSummary: 'Database connection pool exhausted',
          fiveWhySummary: '1. Why did the app crash? DB pool exhausted...',
          contributingFactors: ['High traffic', 'No pool limits'],
          rootCauseCategory: RootCauseCategory.CAPACITY_ISSUE,
          detectionGap: 'No DB pool monitoring alarm',
          monitoringGap: 'Need pool saturation metric',
        },
      );

      expect(result).not.toBeNull();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'problem.rca-completed',
        expect.objectContaining({
          problemId: mockProblemId,
          rootCauseCategory: RootCauseCategory.CAPACITY_ISSUE,
        }),
      );
    });

    it('should reject RCA completion without rootCauseSummary when existing is also empty', async () => {
      const existing = {
        ...baseProblem,
        rootCauseSummary: null,
      } as ItsmProblem;
      problemRepo.findOne.mockResolvedValue(existing);

      await expect(
        service.completeRca(mockTenantId, mockUserId, mockProblemId, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow RCA completion when existing rootCauseSummary is present', async () => {
      const existing = {
        ...baseProblem,
        rootCauseSummary: 'Already documented',
      } as ItsmProblem;
      problemRepo.findOne.mockResolvedValue(existing);
      problemRepo.save.mockImplementation((entity: any) =>
        Promise.resolve({ ...existing, ...entity }),
      );

      const result = await service.completeRca(
        mockTenantId,
        mockUserId,
        mockProblemId,
        { fiveWhySummary: 'Additional analysis' },
      );

      expect(result).not.toBeNull();
    });

    it('should return null when problem not found', async () => {
      problemRepo.findOne.mockResolvedValue(null);

      const result = await service.completeRca(
        mockTenantId,
        mockUserId,
        'missing-id',
        { rootCauseSummary: 'test' },
      );

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Tenant isolation
  // ==========================================================================

  describe('tenant isolation for Phase 2 methods', () => {
    it('reopenProblem should scope by tenantId', async () => {
      problemRepo.findOne.mockResolvedValue(null);

      await service.reopenProblem(
        mockTenantId,
        mockUserId,
        'some-id',
        'reason',
      );

      expect(problemRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: mockTenantId,
            isDeleted: false,
          }),
        }),
      );
    });

    it('completeRca should scope by tenantId', async () => {
      problemRepo.findOne.mockResolvedValue(null);

      await service.completeRca(mockTenantId, mockUserId, 'some-id', {
        rootCauseSummary: 'test',
      });

      expect(problemRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: mockTenantId,
            isDeleted: false,
          }),
        }),
      );
    });
  });
});
