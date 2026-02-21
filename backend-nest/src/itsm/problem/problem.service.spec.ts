import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException } from '@nestjs/common';

import { ProblemService } from './problem.service';
import { ItsmProblem } from './problem.entity';
import { ItsmProblemIncident } from './problem-incident.entity';
import { ItsmProblemChange } from './problem-change.entity';
import { ItsmIncident } from '../incident/incident.entity';
import {
  IncidentStatus,
  ProblemCategory,
  ProblemChangeLinkType,
  ProblemImpact,
  ProblemPriority,
  ProblemState,
  ProblemUrgency,
} from '../enums';
import { AuditService } from '../../audit/audit.service';
import { ProblemFilterDto } from './dto/problem-filter.dto';

describe('ProblemService', () => {
  let service: ProblemService;
  let repository: jest.Mocked<Repository<ItsmProblem>>;
  let problemIncidentRepo: jest.Mocked<Repository<ItsmProblemIncident>>;
  let problemChangeRepo: jest.Mocked<Repository<ItsmProblemChange>>;
  let incidentRepo: jest.Mocked<Repository<ItsmIncident>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let auditService: jest.Mocked<AuditService>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';
  const mockUserId = '00000000-0000-0000-0000-000000000002';

  const mockProblem: Partial<ItsmProblem> = {
    id: '00000000-0000-0000-0000-000000000101',
    tenantId: mockTenantId,
    number: 'PRB000001',
    shortDescription: 'Test Problem',
    category: ProblemCategory.SOFTWARE,
    state: ProblemState.NEW,
    impact: ProblemImpact.MEDIUM,
    urgency: ProblemUrgency.MEDIUM,
    priority: ProblemPriority.P3,
    knownError: false,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: mockUserId,
    updatedBy: null,
  };

  beforeEach(async () => {
    const mockRepository = {
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

    const mockIncidentRepo = {
      findOne: jest.fn(),
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
        { provide: getRepositoryToken(ItsmProblem), useValue: mockRepository },
        {
          provide: getRepositoryToken(ItsmProblemIncident),
          useValue: mockProblemIncidentRepo,
        },
        {
          provide: getRepositoryToken(ItsmProblemChange),
          useValue: mockProblemChangeRepo,
        },
        {
          provide: getRepositoryToken(ItsmIncident),
          useValue: mockIncidentRepo,
        },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ProblemService>(ProblemService);
    repository = module.get(getRepositoryToken(ItsmProblem));
    problemIncidentRepo = module.get(getRepositoryToken(ItsmProblemIncident));
    problemChangeRepo = module.get(getRepositoryToken(ItsmProblemChange));
    incidentRepo = module.get(getRepositoryToken(ItsmIncident));
    eventEmitter = module.get(EventEmitter2);
    auditService = module.get(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProblem', () => {
    it('should create a new problem with auto-generated number and priority', async () => {
      const createData: Partial<ItsmProblem> = {
        shortDescription: 'New Problem',
        category: ProblemCategory.INFRASTRUCTURE,
        impact: ProblemImpact.HIGH,
        urgency: ProblemUrgency.HIGH,
      };

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxNumber: null }),
      };

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      repository.create.mockReturnValue({
        ...createData,
        id: '00000000-0000-0000-0000-000000000102',
        tenantId: mockTenantId,
        number: 'PRB000001',
        priority: ProblemPriority.P1,
        openedAt: expect.any(Date),
        createdBy: mockUserId,
        isDeleted: false,
      } as ItsmProblem);

      repository.save.mockResolvedValue({
        ...createData,
        id: '00000000-0000-0000-0000-000000000102',
        tenantId: mockTenantId,
        number: 'PRB000001',
        priority: ProblemPriority.P1,
        openedAt: new Date(),
        createdBy: mockUserId,
        isDeleted: false,
      } as ItsmProblem);

      const result = await service.createProblem(
        mockTenantId,
        mockUserId,
        createData,
      );

      expect(result.number).toBe('PRB000001');
      expect(result.priority).toBe(ProblemPriority.P1);
      expect(auditService.recordCreate).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'problem.created',
        expect.objectContaining({ tenantId: mockTenantId, userId: mockUserId }),
      );
    });

    it('should generate sequential problem numbers', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxNumber: 'PRB000005' }),
      };

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      repository.create.mockReturnValue({
        ...mockProblem,
        id: '00000000-0000-0000-0000-000000000103',
        number: 'PRB000006',
      } as ItsmProblem);

      repository.save.mockResolvedValue({
        ...mockProblem,
        id: '00000000-0000-0000-0000-000000000103',
        number: 'PRB000006',
      } as ItsmProblem);

      const result = await service.createProblem(mockTenantId, mockUserId, {
        shortDescription: 'Another Problem',
      });

      expect(result.number).toBe('PRB000006');
    });
  });

  describe('updateProblem', () => {
    it('should recalculate priority when impact changes', async () => {
      const existing = { ...mockProblem } as ItsmProblem;

      repository.findOne.mockResolvedValue(existing);
      repository.save.mockImplementation((entity: any) =>
        Promise.resolve(entity),
      );

      const result = await service.updateProblem(
        mockTenantId,
        mockUserId,
        existing.id,
        {
          impact: ProblemImpact.HIGH,
          urgency: ProblemUrgency.HIGH,
        },
      );

      expect(result?.priority).toBe(ProblemPriority.P1);
      expect(auditService.recordUpdate).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'problem.updated',
        expect.objectContaining({ tenantId: mockTenantId, userId: mockUserId }),
      );
    });

    it('should return null when problem not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.updateProblem(
        mockTenantId,
        mockUserId,
        'missing',
        {
          shortDescription: 'Update',
        },
      );

      expect(result).toBeNull();
    });
  });

  describe('findWithFilters', () => {
    it('should fall back to createdAt when sortBy is invalid', async () => {
      const filterDto = {
        page: 1,
        pageSize: 10,
        sortBy: 'notAField',
        sortOrder: 'ASC',
      } as unknown as ProblemFilterDto;

      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      };

      repository.createQueryBuilder.mockReturnValue(qb as any);

      await service.findWithFilters(mockTenantId, filterDto);

      expect(qb.orderBy).toHaveBeenCalledWith('problem.createdAt', 'ASC');
    });
  });

  describe('linkIncident', () => {
    it('should throw NotFoundException when problem does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.linkIncident(
          mockTenantId,
          mockUserId,
          'missing-problem',
          'incident',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when incident is not in tenant', async () => {
      repository.findOne.mockResolvedValue(mockProblem as ItsmProblem);
      incidentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.linkIncident(
          mockTenantId,
          mockUserId,
          mockProblem.id!,
          'missing-incident',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create a link when incident exists', async () => {
      repository.findOne.mockResolvedValue(mockProblem as ItsmProblem);
      incidentRepo.findOne.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000201',
        tenantId: mockTenantId,
        status: IncidentStatus.OPEN,
        isDeleted: false,
      } as ItsmIncident);

      problemIncidentRepo.findOne.mockResolvedValue(null);
      problemIncidentRepo.create.mockReturnValue({
        id: '00000000-0000-0000-0000-000000000301',
        tenantId: mockTenantId,
        problemId: mockProblem.id,
        incidentId: '00000000-0000-0000-0000-000000000201',
        createdBy: mockUserId,
        isDeleted: false,
      } as ItsmProblemIncident);
      problemIncidentRepo.save.mockImplementation((entity: any) =>
        Promise.resolve(entity),
      );

      const result = await service.linkIncident(
        mockTenantId,
        mockUserId,
        mockProblem.id!,
        '00000000-0000-0000-0000-000000000201',
      );

      expect(result.problemId).toBe(mockProblem.id);
      expect(problemIncidentRepo.save).toHaveBeenCalled();
    });
  });

  describe('getProblemSummary', () => {
    it('should compute openIncidentCount using IncidentStatus enums', async () => {
      problemIncidentRepo.find.mockResolvedValue([
        {
          id: '1',
          tenantId: mockTenantId,
          problemId: mockProblem.id,
          incidentId: 'inc1',
          createdAt: new Date(),
          incident: {
            status: IncidentStatus.OPEN,
            isDeleted: false,
          } as ItsmIncident,
        } as ItsmProblemIncident,
        {
          id: '2',
          tenantId: mockTenantId,
          problemId: mockProblem.id,
          incidentId: 'inc2',
          createdAt: new Date(),
          incident: {
            status: IncidentStatus.CLOSED,
            isDeleted: false,
          } as ItsmIncident,
        } as ItsmProblemIncident,
      ]);

      problemChangeRepo.find.mockResolvedValue([
        {
          id: '3',
          tenantId: mockTenantId,
          problemId: mockProblem.id,
          changeId: 'chg1',
          createdAt: new Date(),
          relationType: ProblemChangeLinkType.PERMANENT_FIX,
        } as ItsmProblemChange,
      ]);

      const result = await service.getProblemSummary(
        mockTenantId,
        mockProblem.id!,
      );

      expect(result.incidentCount).toBe(2);
      expect(result.openIncidentCount).toBe(1);
      expect(result.permanentFixCount).toBe(1);
    });
  });
});
