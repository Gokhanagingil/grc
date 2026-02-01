import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GrcRiskService } from './grc-risk.service';
import { GrcRisk } from '../entities/grc-risk.entity';
import { GrcRiskHistory } from '../entities/history';
import { GrcRiskPolicy } from '../entities/grc-risk-policy.entity';
import { GrcRiskRequirement } from '../entities/grc-risk-requirement.entity';
import { GrcRiskControl } from '../entities/grc-risk-control.entity';
import { GrcRiskAssessment } from '../entities/grc-risk-assessment.entity';
import { GrcPolicy } from '../entities/grc-policy.entity';
import { GrcRequirement } from '../entities/grc-requirement.entity';
import { GrcControl } from '../entities/grc-control.entity';
import { AuditService } from '../../audit/audit.service';
import { UniversalListService } from '../../common';
import { CodeGeneratorService } from './code-generator.service';
import { RiskSeverity, RiskLikelihood, RiskStatus } from '../enums';

describe('GrcRiskService', () => {
  let service: GrcRiskService;
  let riskRepository: jest.Mocked<Repository<GrcRisk>>;
  let historyRepository: jest.Mocked<Repository<GrcRiskHistory>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let auditService: jest.Mocked<AuditService>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';
  const mockUserId = '00000000-0000-0000-0000-000000000002';
  const mockRiskId = '00000000-0000-0000-0000-000000000003';

  const mockRisk: Partial<GrcRisk> = {
    id: mockRiskId,
    tenantId: mockTenantId,
    title: 'Test Risk',
    description: 'A test risk for unit testing',
    category: 'Testing',
    severity: RiskSeverity.HIGH,
    likelihood: RiskLikelihood.POSSIBLE,
    impact: RiskSeverity.MEDIUM,
    status: RiskStatus.IDENTIFIED,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: mockUserId,
  };

  beforeEach(async () => {
    const mockRiskRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      merge: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockHistoryRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockRiskPolicyRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      }),
    };

    const mockRiskRequirementRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      }),
    };

    const mockPolicyRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const mockRequirementRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const mockRiskControlRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const mockControlRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const mockAssessmentRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const mockAuditService = {
      recordCreate: jest.fn(),
      recordUpdate: jest.fn(),
      recordDelete: jest.fn(),
    };

    const mockUniversalListService = {
      findWithFilters: jest.fn(),
    };

    const mockCodeGeneratorService = {
      generateCode: jest.fn().mockResolvedValue('RISK-001'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrcRiskService,
        {
          provide: getRepositoryToken(GrcRisk),
          useValue: mockRiskRepository,
        },
        {
          provide: getRepositoryToken(GrcRiskHistory),
          useValue: mockHistoryRepository,
        },
        {
          provide: getRepositoryToken(GrcRiskPolicy),
          useValue: mockRiskPolicyRepository,
        },
        {
          provide: getRepositoryToken(GrcRiskRequirement),
          useValue: mockRiskRequirementRepository,
        },
        {
          provide: getRepositoryToken(GrcPolicy),
          useValue: mockPolicyRepository,
        },
        {
          provide: getRepositoryToken(GrcRequirement),
          useValue: mockRequirementRepository,
        },
        {
          provide: getRepositoryToken(GrcRiskControl),
          useValue: mockRiskControlRepository,
        },
        {
          provide: getRepositoryToken(GrcControl),
          useValue: mockControlRepository,
        },
        {
          provide: getRepositoryToken(GrcRiskAssessment),
          useValue: mockAssessmentRepository,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: UniversalListService,
          useValue: mockUniversalListService,
        },
        {
          provide: CodeGeneratorService,
          useValue: mockCodeGeneratorService,
        },
      ],
    }).compile();

    service = module.get<GrcRiskService>(GrcRiskService);
    riskRepository = module.get(getRepositoryToken(GrcRisk));
    historyRepository = module.get(getRepositoryToken(GrcRiskHistory));
    eventEmitter = module.get(EventEmitter2);
    auditService = module.get(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRisk', () => {
    it('should create a new risk with tenant ID', async () => {
      const createData = {
        title: 'New Risk',
        description: 'A new risk',
        severity: RiskSeverity.HIGH,
        likelihood: RiskLikelihood.LIKELY,
      };

      const createdRisk = {
        ...mockRisk,
        ...createData,
        id: mockRiskId,
        tenantId: mockTenantId,
        createdBy: mockUserId,
        isDeleted: false,
      };

      riskRepository.create.mockReturnValue(createdRisk as GrcRisk);
      riskRepository.save.mockResolvedValue(createdRisk as GrcRisk);
      historyRepository.create.mockReturnValue({} as GrcRiskHistory);
      historyRepository.save.mockResolvedValue({} as GrcRiskHistory);

      const result = await service.createRisk(
        mockTenantId,
        mockUserId,
        createData,
      );

      expect(result).toEqual(createdRisk);
      expect(riskRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createData,
          tenantId: mockTenantId,
          createdBy: mockUserId,
          isDeleted: false,
        }),
      );
      expect(riskRepository.save).toHaveBeenCalled();
      expect(auditService.recordCreate).toHaveBeenCalledWith(
        'GrcRisk',
        createdRisk,
        mockUserId,
        mockTenantId,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'risk.created',
        expect.anything(),
      );
    });

    it('should create history entry when creating a risk', async () => {
      const createData = {
        title: 'New Risk',
        severity: RiskSeverity.MEDIUM,
        likelihood: RiskLikelihood.POSSIBLE,
        impact: RiskSeverity.LOW,
      };

      const createdRisk = {
        ...mockRisk,
        ...createData,
      };

      riskRepository.create.mockReturnValue(createdRisk as GrcRisk);
      riskRepository.save.mockResolvedValue(createdRisk as GrcRisk);
      historyRepository.create.mockReturnValue({} as GrcRiskHistory);
      historyRepository.save.mockResolvedValue({} as GrcRiskHistory);

      await service.createRisk(mockTenantId, mockUserId, createData);

      expect(historyRepository.create).toHaveBeenCalled();
      expect(historyRepository.save).toHaveBeenCalled();
    });
  });

  describe('updateRisk', () => {
    it('should update an existing risk', async () => {
      const updateData = {
        title: 'Updated Risk Title',
        severity: RiskSeverity.CRITICAL,
      };

      const existingRisk = { ...mockRisk };
      const updatedRisk = { ...mockRisk, ...updateData };

      riskRepository.findOne.mockResolvedValue(existingRisk as GrcRisk);
      riskRepository.merge.mockReturnValue(updatedRisk as GrcRisk);
      riskRepository.save.mockResolvedValue(updatedRisk as GrcRisk);
      historyRepository.create.mockReturnValue({} as GrcRiskHistory);
      historyRepository.save.mockResolvedValue({} as GrcRiskHistory);

      const result = await service.updateRisk(
        mockTenantId,
        mockUserId,
        mockRiskId,
        updateData,
      );

      expect(result).toEqual(updatedRisk);
      expect(riskRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockRiskId, tenantId: mockTenantId, isDeleted: false },
      });
      expect(auditService.recordUpdate).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'risk.updated',
        expect.anything(),
      );
    });

    it('should return null when updating non-existent risk', async () => {
      riskRepository.findOne.mockResolvedValue(null);

      const result = await service.updateRisk(
        mockTenantId,
        mockUserId,
        'non-existent-id',
        { title: 'Updated' },
      );

      expect(result).toBeNull();
      expect(riskRepository.save).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should not update risk from different tenant', async () => {
      const differentTenantId = '00000000-0000-0000-0000-000000000099';

      riskRepository.findOne.mockResolvedValue(null);

      const result = await service.updateRisk(
        differentTenantId,
        mockUserId,
        mockRiskId,
        { title: 'Updated' },
      );

      expect(result).toBeNull();
      expect(riskRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: mockRiskId,
          tenantId: differentTenantId,
          isDeleted: false,
        },
      });
    });
  });

  describe('softDeleteRisk', () => {
    it('should soft delete a risk by setting isDeleted to true', async () => {
      const existingRisk = { ...mockRisk, isDeleted: false };
      const deletedRisk = { ...mockRisk, isDeleted: true };

      riskRepository.findOne
        .mockResolvedValueOnce(existingRisk as GrcRisk)
        .mockResolvedValueOnce(existingRisk as GrcRisk);
      riskRepository.merge.mockReturnValue(deletedRisk as GrcRisk);
      riskRepository.save.mockResolvedValue(deletedRisk as GrcRisk);
      historyRepository.create.mockReturnValue({} as GrcRiskHistory);
      historyRepository.save.mockResolvedValue({} as GrcRiskHistory);

      const result = await service.softDeleteRisk(
        mockTenantId,
        mockUserId,
        mockRiskId,
      );

      expect(result).toBe(true);
      expect(auditService.recordDelete).toHaveBeenCalledWith(
        'GrcRisk',
        existingRisk,
        mockUserId,
        mockTenantId,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'risk.deleted',
        expect.anything(),
      );
    });

    it('should return false when soft deleting non-existent risk', async () => {
      riskRepository.findOne.mockResolvedValue(null);

      const result = await service.softDeleteRisk(
        mockTenantId,
        mockUserId,
        'non-existent-id',
      );

      expect(result).toBe(false);
      expect(auditService.recordDelete).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should return false when soft deleting already deleted risk', async () => {
      riskRepository.findOne.mockResolvedValue(null);

      const result = await service.softDeleteRisk(
        mockTenantId,
        mockUserId,
        mockRiskId,
      );

      expect(result).toBe(false);
    });
  });

  describe('findOneActiveForTenant', () => {
    it('should return risk when found and not deleted', async () => {
      riskRepository.findOne.mockResolvedValue(mockRisk as GrcRisk);

      const result = await service.findOneActiveForTenant(
        mockTenantId,
        mockRiskId,
      );

      expect(result).toEqual(mockRisk);
      expect(riskRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockRiskId, tenantId: mockTenantId, isDeleted: false },
      });
    });

    it('should return null when risk not found', async () => {
      riskRepository.findOne.mockResolvedValue(null);

      const result = await service.findOneActiveForTenant(
        mockTenantId,
        'non-existent-id',
      );

      expect(result).toBeNull();
    });

    it('should return null when risk is deleted', async () => {
      riskRepository.findOne.mockResolvedValue(null);

      const result = await service.findOneActiveForTenant(
        mockTenantId,
        mockRiskId,
      );

      expect(result).toBeNull();
    });
  });

  describe('findAllActiveForTenant', () => {
    it('should return all active risks for tenant', async () => {
      const risks = [mockRisk, { ...mockRisk, id: 'risk-2', title: 'Risk 2' }];
      riskRepository.find.mockResolvedValue(risks as GrcRisk[]);

      const result = await service.findAllActiveForTenant(mockTenantId);

      expect(result).toEqual(risks);
      expect(riskRepository.find).toHaveBeenCalledWith({
        where: { tenantId: mockTenantId, isDeleted: false },
        order: undefined,
        relations: undefined,
      });
    });

    it('should filter by additional criteria', async () => {
      const risks = [mockRisk];
      riskRepository.find.mockResolvedValue(risks as GrcRisk[]);

      const result = await service.findAllActiveForTenant(mockTenantId, {
        where: { status: RiskStatus.IDENTIFIED },
        order: { createdAt: 'DESC' },
      });

      expect(result).toEqual(risks);
      expect(riskRepository.find).toHaveBeenCalledWith({
        where: {
          status: RiskStatus.IDENTIFIED,
          tenantId: mockTenantId,
          isDeleted: false,
        },
        order: { createdAt: 'DESC' },
        relations: undefined,
      });
    });
  });

  describe('findByStatus', () => {
    it('should return risks filtered by status', async () => {
      const risks = [mockRisk];
      riskRepository.find.mockResolvedValue(risks as GrcRisk[]);

      const result = await service.findByStatus(
        mockTenantId,
        RiskStatus.IDENTIFIED,
      );

      expect(result).toEqual(risks);
    });
  });

  describe('findBySeverity', () => {
    it('should return risks filtered by severity', async () => {
      const risks = [mockRisk];
      riskRepository.find.mockResolvedValue(risks as GrcRisk[]);

      const result = await service.findBySeverity(
        mockTenantId,
        RiskSeverity.HIGH,
      );

      expect(result).toEqual(risks);
    });
  });

  describe('getStatistics', () => {
    it('should return risk statistics for tenant', async () => {
      const risks = [
        {
          ...mockRisk,
          status: RiskStatus.IDENTIFIED,
          severity: RiskSeverity.HIGH,
        },
        {
          ...mockRisk,
          id: 'risk-2',
          status: RiskStatus.IDENTIFIED,
          severity: RiskSeverity.MEDIUM,
        },
        {
          ...mockRisk,
          id: 'risk-3',
          status: RiskStatus.CLOSED,
          severity: RiskSeverity.LOW,
        },
      ];
      riskRepository.find.mockResolvedValue(risks as GrcRisk[]);

      const result = await service.getStatistics(mockTenantId);

      expect(result).toEqual({
        total: 3,
        byStatus: {
          [RiskStatus.IDENTIFIED]: 2,
          [RiskStatus.CLOSED]: 1,
        },
        bySeverity: {
          [RiskSeverity.HIGH]: 1,
          [RiskSeverity.MEDIUM]: 1,
          [RiskSeverity.LOW]: 1,
        },
      });
    });
  });

  describe('tenant isolation', () => {
    it('should not return risks from different tenant', async () => {
      const differentTenantId = '00000000-0000-0000-0000-000000000099';
      riskRepository.findOne.mockResolvedValue(null);

      const result = await service.findOneActiveForTenant(
        differentTenantId,
        mockRiskId,
      );

      expect(result).toBeNull();
      expect(riskRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: mockRiskId,
          tenantId: differentTenantId,
          isDeleted: false,
        },
      });
    });

    it('should only return risks belonging to the specified tenant', async () => {
      const tenantRisks = [mockRisk];
      riskRepository.find.mockResolvedValue(tenantRisks as GrcRisk[]);

      const result = await service.findAllActiveForTenant(mockTenantId);

      expect(result).toEqual(tenantRisks);
      expect(riskRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: mockTenantId,
          }),
        }),
      );
    });
  });
});
