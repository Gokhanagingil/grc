import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GrcRequirementService } from './grc-requirement.service';
import { GrcRequirement } from '../entities/grc-requirement.entity';
import { GrcRiskRequirement } from '../entities/grc-risk-requirement.entity';
import { ComplianceFramework } from '../enums';

describe('GrcRequirementService', () => {
  let service: GrcRequirementService;
  let requirementRepository: jest.Mocked<Repository<GrcRequirement>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';
  const mockUserId = '00000000-0000-0000-0000-000000000002';
  const mockRequirementId = '00000000-0000-0000-0000-000000000003';

  const mockRequirement: Partial<GrcRequirement> = {
    id: mockRequirementId,
    tenantId: mockTenantId,
    framework: ComplianceFramework.ISO27001,
    referenceCode: 'A.5.1',
    title: 'Test Requirement',
    description: 'A test requirement for unit testing',
    category: 'Access Control',
    priority: 'High',
    status: 'not_started',
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockRequirementRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      merge: jest.fn(),
      createQueryBuilder: jest.fn(),
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

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrcRequirementService,
        {
          provide: getRepositoryToken(GrcRequirement),
          useValue: mockRequirementRepository,
        },
        {
          provide: getRepositoryToken(GrcRiskRequirement),
          useValue: mockRiskRequirementRepository,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<GrcRequirementService>(GrcRequirementService);
    requirementRepository = module.get(getRepositoryToken(GrcRequirement));
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRequirement', () => {
    it('should create a new requirement with tenant ID', async () => {
      const createData = {
        framework: ComplianceFramework.GDPR,
        referenceCode: 'GDPR-001',
        title: 'Data Protection Requirement',
        description: 'Ensure data protection compliance',
        category: 'Privacy',
        priority: 'Critical',
      };

      const createdRequirement = {
        ...mockRequirement,
        ...createData,
        id: mockRequirementId,
        tenantId: mockTenantId,
        isDeleted: false,
      };

      requirementRepository.create.mockReturnValue(
        createdRequirement as GrcRequirement,
      );
      requirementRepository.save.mockResolvedValue(
        createdRequirement as GrcRequirement,
      );

      const result = await service.createRequirement(
        mockTenantId,
        mockUserId,
        createData,
      );

      expect(result).toEqual(createdRequirement);
      expect(requirementRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createData,
          tenantId: mockTenantId,
          isDeleted: false,
        }),
      );
      expect(requirementRepository.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'requirement.created',
        expect.anything(),
      );
    });

    it('should create requirement with required fields only', async () => {
      const createData = {
        framework: ComplianceFramework.SOC2,
        referenceCode: 'CC1.1',
        title: 'Control Environment',
      };

      const createdRequirement = {
        ...mockRequirement,
        ...createData,
        id: mockRequirementId,
        tenantId: mockTenantId,
        isDeleted: false,
      };

      requirementRepository.create.mockReturnValue(
        createdRequirement as GrcRequirement,
      );
      requirementRepository.save.mockResolvedValue(
        createdRequirement as GrcRequirement,
      );

      const result = await service.createRequirement(
        mockTenantId,
        mockUserId,
        createData,
      );

      expect(result).toEqual(createdRequirement);
      expect(result.framework).toBe(ComplianceFramework.SOC2);
      expect(result.referenceCode).toBe('CC1.1');
      expect(result.title).toBe('Control Environment');
    });
  });

  describe('updateRequirement', () => {
    it('should update an existing requirement', async () => {
      const updateData = {
        title: 'Updated Requirement Title',
        status: 'in_progress',
      };

      const existingRequirement = { ...mockRequirement };
      const updatedRequirement = { ...mockRequirement, ...updateData };

      requirementRepository.findOne.mockResolvedValue(
        existingRequirement as GrcRequirement,
      );
      requirementRepository.merge.mockReturnValue(
        updatedRequirement as GrcRequirement,
      );
      requirementRepository.save.mockResolvedValue(
        updatedRequirement as GrcRequirement,
      );

      const result = await service.updateRequirement(
        mockTenantId,
        mockUserId,
        mockRequirementId,
        updateData,
      );

      expect(result).toEqual(updatedRequirement);
      expect(requirementRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: mockRequirementId,
          tenantId: mockTenantId,
          isDeleted: false,
        },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'requirement.updated',
        expect.anything(),
      );
    });

    it('should return null when updating non-existent requirement', async () => {
      requirementRepository.findOne.mockResolvedValue(null);

      const result = await service.updateRequirement(
        mockTenantId,
        mockUserId,
        'non-existent-id',
        { title: 'Updated' },
      );

      expect(result).toBeNull();
      expect(requirementRepository.save).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should not update requirement from different tenant', async () => {
      const differentTenantId = '00000000-0000-0000-0000-000000000099';

      requirementRepository.findOne.mockResolvedValue(null);

      const result = await service.updateRequirement(
        differentTenantId,
        mockUserId,
        mockRequirementId,
        { title: 'Updated' },
      );

      expect(result).toBeNull();
      expect(requirementRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: mockRequirementId,
          tenantId: differentTenantId,
          isDeleted: false,
        },
      });
    });
  });

  describe('softDeleteRequirement', () => {
    it('should soft delete a requirement by setting isDeleted to true', async () => {
      const existingRequirement = { ...mockRequirement, isDeleted: false };
      const deletedRequirement = { ...mockRequirement, isDeleted: true };

      requirementRepository.findOne
        .mockResolvedValueOnce(existingRequirement as GrcRequirement)
        .mockResolvedValueOnce(existingRequirement as GrcRequirement);
      requirementRepository.merge.mockReturnValue(
        deletedRequirement as GrcRequirement,
      );
      requirementRepository.save.mockResolvedValue(
        deletedRequirement as GrcRequirement,
      );

      const result = await service.softDeleteRequirement(
        mockTenantId,
        mockUserId,
        mockRequirementId,
      );

      expect(result).toBe(true);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'requirement.deleted',
        expect.anything(),
      );
    });

    it('should return false when soft deleting non-existent requirement', async () => {
      requirementRepository.findOne.mockResolvedValue(null);

      const result = await service.softDeleteRequirement(
        mockTenantId,
        mockUserId,
        'non-existent-id',
      );

      expect(result).toBe(false);
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should return false when soft deleting already deleted requirement', async () => {
      requirementRepository.findOne.mockResolvedValue(null);

      const result = await service.softDeleteRequirement(
        mockTenantId,
        mockUserId,
        mockRequirementId,
      );

      expect(result).toBe(false);
    });
  });

  describe('findOneActiveForTenant', () => {
    it('should return requirement when found and not deleted', async () => {
      requirementRepository.findOne.mockResolvedValue(
        mockRequirement as GrcRequirement,
      );

      const result = await service.findOneActiveForTenant(
        mockTenantId,
        mockRequirementId,
      );

      expect(result).toEqual(mockRequirement);
      expect(requirementRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: mockRequirementId,
          tenantId: mockTenantId,
          isDeleted: false,
        },
      });
    });

    it('should return null when requirement not found', async () => {
      requirementRepository.findOne.mockResolvedValue(null);

      const result = await service.findOneActiveForTenant(
        mockTenantId,
        'non-existent-id',
      );

      expect(result).toBeNull();
    });

    it('should return null when requirement is deleted', async () => {
      requirementRepository.findOne.mockResolvedValue(null);

      const result = await service.findOneActiveForTenant(
        mockTenantId,
        mockRequirementId,
      );

      expect(result).toBeNull();
    });
  });

  describe('findAllActiveForTenant', () => {
    it('should return all active requirements for tenant', async () => {
      const requirements = [
        mockRequirement,
        { ...mockRequirement, id: 'req-2', title: 'Requirement 2' },
      ];
      requirementRepository.find.mockResolvedValue(
        requirements as GrcRequirement[],
      );

      const result = await service.findAllActiveForTenant(mockTenantId);

      expect(result).toEqual(requirements);
      expect(requirementRepository.find).toHaveBeenCalledWith({
        where: { tenantId: mockTenantId, isDeleted: false },
        order: undefined,
        relations: undefined,
      });
    });

    it('should filter by additional criteria', async () => {
      const requirements = [mockRequirement];
      requirementRepository.find.mockResolvedValue(
        requirements as GrcRequirement[],
      );

      const result = await service.findAllActiveForTenant(mockTenantId, {
        where: { framework: ComplianceFramework.ISO27001 },
        order: { referenceCode: 'ASC' },
      });

      expect(result).toEqual(requirements);
      expect(requirementRepository.find).toHaveBeenCalledWith({
        where: {
          framework: ComplianceFramework.ISO27001,
          tenantId: mockTenantId,
          isDeleted: false,
        },
        order: { referenceCode: 'ASC' },
        relations: undefined,
      });
    });
  });

  describe('findByFramework', () => {
    it('should return requirements filtered by framework', async () => {
      const requirements = [mockRequirement];
      requirementRepository.find.mockResolvedValue(
        requirements as GrcRequirement[],
      );

      const result = await service.findByFramework(
        mockTenantId,
        ComplianceFramework.ISO27001,
      );

      expect(result).toEqual(requirements);
    });
  });

  describe('findByStatus', () => {
    it('should return requirements filtered by status', async () => {
      const requirements = [mockRequirement];
      requirementRepository.find.mockResolvedValue(
        requirements as GrcRequirement[],
      );

      const result = await service.findByStatus(mockTenantId, 'not_started');

      expect(result).toEqual(requirements);
    });
  });

  describe('getFrameworks', () => {
    it('should return unique frameworks used by tenant', async () => {
      const requirements = [
        { ...mockRequirement, framework: ComplianceFramework.ISO27001 },
        {
          ...mockRequirement,
          id: 'req-2',
          framework: ComplianceFramework.GDPR,
        },
        {
          ...mockRequirement,
          id: 'req-3',
          framework: ComplianceFramework.ISO27001,
        },
      ];
      requirementRepository.find.mockResolvedValue(
        requirements as GrcRequirement[],
      );

      const result = await service.getFrameworks(mockTenantId);

      expect(result).toContain(ComplianceFramework.ISO27001);
      expect(result).toContain(ComplianceFramework.GDPR);
      expect(result.length).toBe(2);
    });
  });

  describe('getStatistics', () => {
    it('should return requirement statistics for tenant', async () => {
      const requirements = [
        {
          ...mockRequirement,
          framework: ComplianceFramework.ISO27001,
          status: 'not_started',
        },
        {
          ...mockRequirement,
          id: 'req-2',
          framework: ComplianceFramework.ISO27001,
          status: 'in_progress',
        },
        {
          ...mockRequirement,
          id: 'req-3',
          framework: ComplianceFramework.GDPR,
          status: 'compliant',
        },
      ];
      requirementRepository.find.mockResolvedValue(
        requirements as GrcRequirement[],
      );

      const result = await service.getStatistics(mockTenantId);

      expect(result).toEqual({
        total: 3,
        byFramework: {
          [ComplianceFramework.ISO27001]: 2,
          [ComplianceFramework.GDPR]: 1,
        },
        byStatus: {
          not_started: 1,
          in_progress: 1,
          compliant: 1,
        },
      });
    });
  });

  describe('tenant isolation', () => {
    it('should not return requirements from different tenant', async () => {
      const differentTenantId = '00000000-0000-0000-0000-000000000099';
      requirementRepository.findOne.mockResolvedValue(null);

      const result = await service.findOneActiveForTenant(
        differentTenantId,
        mockRequirementId,
      );

      expect(result).toBeNull();
      expect(requirementRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: mockRequirementId,
          tenantId: differentTenantId,
          isDeleted: false,
        },
      });
    });

    it('should only return requirements belonging to the specified tenant', async () => {
      const tenantRequirements = [mockRequirement];
      requirementRepository.find.mockResolvedValue(
        tenantRequirements as GrcRequirement[],
      );

      const result = await service.findAllActiveForTenant(mockTenantId);

      expect(result).toEqual(tenantRequirements);
      expect(requirementRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: mockTenantId,
          }),
        }),
      );
    });
  });
});
