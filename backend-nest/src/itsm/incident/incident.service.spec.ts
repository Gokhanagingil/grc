import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IncidentService } from './incident.service';
import { ItsmIncident } from './incident.entity';
import { AuditService } from '../../audit/audit.service';
import {
  IncidentCategory,
  IncidentImpact,
  IncidentUrgency,
  IncidentPriority,
  IncidentStatus,
  IncidentSource,
} from '../enums';
import { IncidentFilterDto } from './dto/incident-filter.dto';

describe('IncidentService', () => {
  let service: IncidentService;
  let repository: jest.Mocked<Repository<ItsmIncident>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let auditService: jest.Mocked<AuditService>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';
  const mockUserId = '00000000-0000-0000-0000-000000000002';

  const mockIncident: Partial<ItsmIncident> = {
    id: '00000000-0000-0000-0000-000000000003',
    tenantId: mockTenantId,
    number: 'INC000001',
    shortDescription: 'Test Incident',
    description: 'Test incident description',
    category: IncidentCategory.SOFTWARE,
    impact: IncidentImpact.MEDIUM,
    urgency: IncidentUrgency.MEDIUM,
    priority: IncidentPriority.P3,
    status: IncidentStatus.OPEN,
    source: IncidentSource.USER,
    assignmentGroup: 'IT Support',
    assignedTo: null,
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
        IncidentService,
        { provide: getRepositoryToken(ItsmIncident), useValue: mockRepository },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<IncidentService>(IncidentService);
    repository = module.get(getRepositoryToken(ItsmIncident));
    eventEmitter = module.get(EventEmitter2);
    auditService = module.get(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createIncident', () => {
    it('should create a new incident with auto-generated number and priority', async () => {
      const createData = {
        shortDescription: 'New Test Incident',
        description: 'Test description',
        category: IncidentCategory.HARDWARE,
        impact: IncidentImpact.HIGH,
        urgency: IncidentUrgency.HIGH,
        source: IncidentSource.MONITORING,
      };

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxNumber: null }),
      };

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      repository.create.mockReturnValue({
        ...createData,
        id: '00000000-0000-0000-0000-000000000004',
        tenantId: mockTenantId,
        number: 'INC000001',
        priority: IncidentPriority.P1,
        status: IncidentStatus.OPEN,
        createdBy: mockUserId,
        isDeleted: false,
      } as ItsmIncident);
      repository.save.mockResolvedValue({
        ...createData,
        id: '00000000-0000-0000-0000-000000000004',
        tenantId: mockTenantId,
        number: 'INC000001',
        priority: IncidentPriority.P1,
        status: IncidentStatus.OPEN,
        createdBy: mockUserId,
        isDeleted: false,
      } as ItsmIncident);

      const result = await service.createIncident(
        mockTenantId,
        mockUserId,
        createData,
      );

      expect(result).toBeDefined();
      expect(result.number).toBe('INC000001');
      expect(result.priority).toBe(IncidentPriority.P1);
      expect(auditService.recordCreate).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'incident.created',
        expect.any(Object),
      );
    });

    it('should generate sequential incident numbers', async () => {
      const createData = {
        shortDescription: 'Another Test Incident',
      };

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxNumber: 'INC000005' }),
      };

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      repository.create.mockReturnValue({
        ...createData,
        id: '00000000-0000-0000-0000-000000000005',
        tenantId: mockTenantId,
        number: 'INC000006',
        priority: IncidentPriority.P3,
        status: IncidentStatus.OPEN,
        createdBy: mockUserId,
        isDeleted: false,
      } as ItsmIncident);
      repository.save.mockResolvedValue({
        ...createData,
        id: '00000000-0000-0000-0000-000000000005',
        tenantId: mockTenantId,
        number: 'INC000006',
        priority: IncidentPriority.P3,
        status: IncidentStatus.OPEN,
        createdBy: mockUserId,
        isDeleted: false,
      } as ItsmIncident);

      const result = await service.createIncident(
        mockTenantId,
        mockUserId,
        createData,
      );

      expect(result.number).toBe('INC000006');
    });

    it('should calculate priority based on impact and urgency matrix', async () => {
      const testCases = [
        {
          impact: IncidentImpact.HIGH,
          urgency: IncidentUrgency.HIGH,
          expected: IncidentPriority.P1,
        },
        {
          impact: IncidentImpact.HIGH,
          urgency: IncidentUrgency.MEDIUM,
          expected: IncidentPriority.P2,
        },
        {
          impact: IncidentImpact.MEDIUM,
          urgency: IncidentUrgency.HIGH,
          expected: IncidentPriority.P2,
        },
        {
          impact: IncidentImpact.LOW,
          urgency: IncidentUrgency.LOW,
          expected: IncidentPriority.P4,
        },
      ];

      for (const testCase of testCases) {
        const mockQueryBuilder = {
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ maxNumber: null }),
        };

        repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
        repository.create.mockReturnValue({
          shortDescription: 'Priority Test',
          id: '00000000-0000-0000-0000-000000000006',
          tenantId: mockTenantId,
          number: 'INC000001',
          priority: testCase.expected,
          impact: testCase.impact,
          urgency: testCase.urgency,
          status: IncidentStatus.OPEN,
          createdBy: mockUserId,
          isDeleted: false,
        } as ItsmIncident);
        repository.save.mockResolvedValue({
          shortDescription: 'Priority Test',
          id: '00000000-0000-0000-0000-000000000006',
          tenantId: mockTenantId,
          number: 'INC000001',
          priority: testCase.expected,
          impact: testCase.impact,
          urgency: testCase.urgency,
          status: IncidentStatus.OPEN,
          createdBy: mockUserId,
          isDeleted: false,
        } as ItsmIncident);

        const result = await service.createIncident(mockTenantId, mockUserId, {
          shortDescription: 'Priority Test',
          impact: testCase.impact,
          urgency: testCase.urgency,
        });

        expect(result.priority).toBe(testCase.expected);
      }
    });
  });

  describe('findOneActiveForTenant', () => {
    it('should return incident when found and not deleted', async () => {
      repository.findOne.mockResolvedValue(mockIncident as ItsmIncident);

      const result = await service.findOneActiveForTenant(
        mockTenantId,
        mockIncident.id!,
      );

      expect(result).toEqual(mockIncident);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          id: mockIncident.id,
          tenantId: mockTenantId,
          isDeleted: false,
        },
      });
    });

    it('should return null when incident not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findOneActiveForTenant(
        mockTenantId,
        'non-existent-id',
      );

      expect(result).toBeNull();
    });

    it('should enforce tenant isolation', async () => {
      const differentTenantId = '00000000-0000-0000-0000-000000000099';
      repository.findOne.mockResolvedValue(null);

      const result = await service.findOneActiveForTenant(
        differentTenantId,
        mockIncident.id!,
      );

      expect(result).toBeNull();
      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          id: mockIncident.id,
          tenantId: differentTenantId,
          isDeleted: false,
        },
      });
    });
  });

  describe('updateIncident', () => {
    it('should update incident and recalculate priority when impact/urgency changes', async () => {
      repository.findOne.mockResolvedValue(mockIncident as ItsmIncident);
      repository.save.mockResolvedValue({
        ...mockIncident,
        impact: IncidentImpact.HIGH,
        urgency: IncidentUrgency.HIGH,
        priority: IncidentPriority.P1,
      } as ItsmIncident);

      const result = await service.updateIncident(
        mockTenantId,
        mockUserId,
        mockIncident.id!,
        {
          impact: IncidentImpact.HIGH,
          urgency: IncidentUrgency.HIGH,
        },
      );

      expect(result).toBeDefined();
      expect(result?.priority).toBe(IncidentPriority.P1);
      expect(auditService.recordUpdate).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'incident.updated',
        expect.any(Object),
      );
    });

    it('should return null when incident not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.updateIncident(
        mockTenantId,
        mockUserId,
        'non-existent-id',
        {
          shortDescription: 'Updated',
        },
      );

      expect(result).toBeNull();
    });
  });

  describe('softDeleteIncident', () => {
    it('should soft delete incident', async () => {
      repository.findOne.mockResolvedValue(mockIncident as ItsmIncident);
      repository.save.mockResolvedValue({
        ...mockIncident,
        isDeleted: true,
      } as ItsmIncident);

      const result = await service.softDeleteIncident(
        mockTenantId,
        mockUserId,
        mockIncident.id!,
      );

      expect(result).toBe(true);
      expect(auditService.recordDelete).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'incident.deleted',
        expect.any(Object),
      );
    });

    it('should return false when incident not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.softDeleteIncident(
        mockTenantId,
        mockUserId,
        'non-existent-id',
      );

      expect(result).toBe(false);
    });
  });

  describe('resolveIncident', () => {
    it('should resolve an open incident', async () => {
      repository.findOne.mockResolvedValue(mockIncident as ItsmIncident);
      repository.save.mockResolvedValue({
        ...mockIncident,
        status: IncidentStatus.RESOLVED,
        resolvedAt: expect.any(Date),
        resolutionNotes: 'Fixed the issue',
      } as ItsmIncident);

      const result = await service.resolveIncident(
        mockTenantId,
        mockUserId,
        mockIncident.id!,
        'Fixed the issue',
      );

      expect(result).toBeDefined();
      expect(result?.status).toBe(IncidentStatus.RESOLVED);
    });

    it('should return null when trying to resolve a closed incident', async () => {
      const closedIncident = { ...mockIncident, status: IncidentStatus.CLOSED };
      repository.findOne.mockResolvedValue(closedIncident as ItsmIncident);

      const result = await service.resolveIncident(
        mockTenantId,
        mockUserId,
        mockIncident.id!,
      );

      expect(result).toBeNull();
    });
  });

  describe('closeIncident', () => {
    it('should close a resolved incident', async () => {
      const resolvedIncident = {
        ...mockIncident,
        status: IncidentStatus.RESOLVED,
      };
      repository.findOne.mockResolvedValue(resolvedIncident as ItsmIncident);
      repository.save.mockResolvedValue({
        ...resolvedIncident,
        status: IncidentStatus.CLOSED,
      } as ItsmIncident);

      const result = await service.closeIncident(
        mockTenantId,
        mockUserId,
        mockIncident.id!,
      );

      expect(result).toBeDefined();
      expect(result?.status).toBe(IncidentStatus.CLOSED);
    });

    it('should return null when trying to close a non-resolved incident', async () => {
      repository.findOne.mockResolvedValue(mockIncident as ItsmIncident);

      const result = await service.closeIncident(
        mockTenantId,
        mockUserId,
        mockIncident.id!,
      );

      expect(result).toBeNull();
    });
  });

  describe('findWithFilters', () => {
    it('should return paginated results with filters', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue([mockIncident]),
      };

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.findWithFilters(mockTenantId, {
        page: 1,
        pageSize: 20,
        status: IncidentStatus.OPEN,
        priority: IncidentPriority.P3,
      } as IncidentFilterDto);

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total', 1);
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('pageSize', 20);
      expect(result.items).toHaveLength(1);
    });

    it('should apply search filter', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      };

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.findWithFilters(mockTenantId, {
        search: 'test search',
      } as IncidentFilterDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.objectContaining({ search: '%test search%' }),
      );
    });
  });

  describe('getStatistics', () => {
    it('should return incident statistics', async () => {
      repository.find.mockResolvedValue([
        {
          ...mockIncident,
          status: IncidentStatus.OPEN,
          priority: IncidentPriority.P1,
          category: IncidentCategory.SOFTWARE,
        },
        {
          ...mockIncident,
          status: IncidentStatus.OPEN,
          priority: IncidentPriority.P2,
          category: IncidentCategory.HARDWARE,
        },
        {
          ...mockIncident,
          status: IncidentStatus.RESOLVED,
          priority: IncidentPriority.P3,
          category: IncidentCategory.SOFTWARE,
        },
      ] as ItsmIncident[]);

      const result = await service.getStatistics(mockTenantId);

      expect(result).toHaveProperty('total', 3);
      expect(result).toHaveProperty('byStatus');
      expect(result).toHaveProperty('byPriority');
      expect(result).toHaveProperty('byCategory');
      expect(result.byStatus[IncidentStatus.OPEN]).toBe(2);
      expect(result.byStatus[IncidentStatus.RESOLVED]).toBe(1);
    });
  });
});
