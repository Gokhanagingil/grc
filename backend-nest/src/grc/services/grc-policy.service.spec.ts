import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GrcPolicyService } from './grc-policy.service';
import { GrcPolicy } from '../entities/grc-policy.entity';
import { PolicyStatus } from '../enums';

describe('GrcPolicyService', () => {
  let service: GrcPolicyService;
  let policyRepository: jest.Mocked<Repository<GrcPolicy>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';
  const mockUserId = '00000000-0000-0000-0000-000000000002';
  const mockPolicyId = '00000000-0000-0000-0000-000000000003';

  const mockPolicy: Partial<GrcPolicy> = {
    id: mockPolicyId,
    tenantId: mockTenantId,
    name: 'Test Policy',
    code: 'POL-001',
    version: '1.0',
    status: PolicyStatus.DRAFT,
    category: 'Security',
    summary: 'A test policy for unit testing',
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPolicyRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      merge: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrcPolicyService,
        {
          provide: getRepositoryToken(GrcPolicy),
          useValue: mockPolicyRepository,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<GrcPolicyService>(GrcPolicyService);
    policyRepository = module.get(getRepositoryToken(GrcPolicy));
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPolicy', () => {
    it('should create a new policy with tenant ID', async () => {
      const createData = {
        name: 'New Policy',
        code: 'POL-NEW',
        version: '1.0',
        status: PolicyStatus.DRAFT,
        category: 'Compliance',
      };

      const createdPolicy = {
        ...mockPolicy,
        ...createData,
        id: mockPolicyId,
        tenantId: mockTenantId,
        isDeleted: false,
      };

      policyRepository.create.mockReturnValue(createdPolicy as GrcPolicy);
      policyRepository.save.mockResolvedValue(createdPolicy as GrcPolicy);

      const result = await service.createPolicy(
        mockTenantId,
        mockUserId,
        createData,
      );

      expect(result).toEqual(createdPolicy);
      expect(policyRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createData,
          tenantId: mockTenantId,
          isDeleted: false,
        }),
      );
      expect(policyRepository.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'policy.created',
        expect.anything(),
      );
    });

    it('should create policy with minimal required fields', async () => {
      const createData = {
        name: 'Minimal Policy',
      };

      const createdPolicy = {
        ...mockPolicy,
        ...createData,
        id: mockPolicyId,
        tenantId: mockTenantId,
        isDeleted: false,
      };

      policyRepository.create.mockReturnValue(createdPolicy as GrcPolicy);
      policyRepository.save.mockResolvedValue(createdPolicy as GrcPolicy);

      const result = await service.createPolicy(
        mockTenantId,
        mockUserId,
        createData,
      );

      expect(result).toEqual(createdPolicy);
      expect(result.name).toBe('Minimal Policy');
    });
  });

  describe('updatePolicy', () => {
    it('should update an existing policy', async () => {
      const updateData = {
        name: 'Updated Policy Name',
        status: PolicyStatus.ACTIVE,
      };

      const existingPolicy = { ...mockPolicy };
      const updatedPolicy = { ...mockPolicy, ...updateData };

      policyRepository.findOne.mockResolvedValue(existingPolicy as GrcPolicy);
      policyRepository.merge.mockReturnValue(updatedPolicy as GrcPolicy);
      policyRepository.save.mockResolvedValue(updatedPolicy as GrcPolicy);

      const result = await service.updatePolicy(
        mockTenantId,
        mockUserId,
        mockPolicyId,
        updateData,
      );

      expect(result).toEqual(updatedPolicy);
      expect(policyRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockPolicyId, tenantId: mockTenantId, isDeleted: false },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'policy.updated',
        expect.anything(),
      );
    });

    it('should return null when updating non-existent policy', async () => {
      policyRepository.findOne.mockResolvedValue(null);

      const result = await service.updatePolicy(
        mockTenantId,
        mockUserId,
        'non-existent-id',
        { name: 'Updated' },
      );

      expect(result).toBeNull();
      expect(policyRepository.save).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should not update policy from different tenant', async () => {
      const differentTenantId = '00000000-0000-0000-0000-000000000099';

      policyRepository.findOne.mockResolvedValue(null);

      const result = await service.updatePolicy(
        differentTenantId,
        mockUserId,
        mockPolicyId,
        { name: 'Updated' },
      );

      expect(result).toBeNull();
      expect(policyRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: mockPolicyId,
          tenantId: differentTenantId,
          isDeleted: false,
        },
      });
    });
  });

  describe('softDeletePolicy', () => {
    it('should soft delete a policy by setting isDeleted to true', async () => {
      const existingPolicy = { ...mockPolicy, isDeleted: false };
      const deletedPolicy = { ...mockPolicy, isDeleted: true };

      policyRepository.findOne
        .mockResolvedValueOnce(existingPolicy as GrcPolicy)
        .mockResolvedValueOnce(existingPolicy as GrcPolicy);
      policyRepository.merge.mockReturnValue(deletedPolicy as GrcPolicy);
      policyRepository.save.mockResolvedValue(deletedPolicy as GrcPolicy);

      const result = await service.softDeletePolicy(
        mockTenantId,
        mockUserId,
        mockPolicyId,
      );

      expect(result).toBe(true);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'policy.deleted',
        expect.anything(),
      );
    });

    it('should return false when soft deleting non-existent policy', async () => {
      policyRepository.findOne.mockResolvedValue(null);

      const result = await service.softDeletePolicy(
        mockTenantId,
        mockUserId,
        'non-existent-id',
      );

      expect(result).toBe(false);
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should return false when soft deleting already deleted policy', async () => {
      policyRepository.findOne.mockResolvedValue(null);

      const result = await service.softDeletePolicy(
        mockTenantId,
        mockUserId,
        mockPolicyId,
      );

      expect(result).toBe(false);
    });
  });

  describe('findOneActiveForTenant', () => {
    it('should return policy when found and not deleted', async () => {
      policyRepository.findOne.mockResolvedValue(mockPolicy as GrcPolicy);

      const result = await service.findOneActiveForTenant(
        mockTenantId,
        mockPolicyId,
      );

      expect(result).toEqual(mockPolicy);
      expect(policyRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockPolicyId, tenantId: mockTenantId, isDeleted: false },
      });
    });

    it('should return null when policy not found', async () => {
      policyRepository.findOne.mockResolvedValue(null);

      const result = await service.findOneActiveForTenant(
        mockTenantId,
        'non-existent-id',
      );

      expect(result).toBeNull();
    });

    it('should return null when policy is deleted', async () => {
      policyRepository.findOne.mockResolvedValue(null);

      const result = await service.findOneActiveForTenant(
        mockTenantId,
        mockPolicyId,
      );

      expect(result).toBeNull();
    });
  });

  describe('findAllActiveForTenant', () => {
    it('should return all active policies for tenant', async () => {
      const policies = [
        mockPolicy,
        { ...mockPolicy, id: 'policy-2', name: 'Policy 2' },
      ];
      policyRepository.find.mockResolvedValue(policies as GrcPolicy[]);

      const result = await service.findAllActiveForTenant(mockTenantId);

      expect(result).toEqual(policies);
      expect(policyRepository.find).toHaveBeenCalledWith({
        where: { tenantId: mockTenantId, isDeleted: false },
        order: undefined,
        relations: undefined,
      });
    });

    it('should filter by additional criteria', async () => {
      const policies = [mockPolicy];
      policyRepository.find.mockResolvedValue(policies as GrcPolicy[]);

      const result = await service.findAllActiveForTenant(mockTenantId, {
        where: { status: PolicyStatus.ACTIVE },
        order: { createdAt: 'DESC' },
      });

      expect(result).toEqual(policies);
      expect(policyRepository.find).toHaveBeenCalledWith({
        where: {
          status: PolicyStatus.ACTIVE,
          tenantId: mockTenantId,
          isDeleted: false,
        },
        order: { createdAt: 'DESC' },
        relations: undefined,
      });
    });
  });

  describe('findByStatus', () => {
    it('should return policies filtered by status', async () => {
      const policies = [mockPolicy];
      policyRepository.find.mockResolvedValue(policies as GrcPolicy[]);

      const result = await service.findByStatus(
        mockTenantId,
        PolicyStatus.DRAFT,
      );

      expect(result).toEqual(policies);
    });
  });

  describe('findActivePolicies', () => {
    it('should return only active policies', async () => {
      const activePolicies = [{ ...mockPolicy, status: PolicyStatus.ACTIVE }];
      policyRepository.find.mockResolvedValue(activePolicies as GrcPolicy[]);

      const result = await service.findActivePolicies(mockTenantId);

      expect(result).toEqual(activePolicies);
    });
  });

  describe('findByCategory', () => {
    it('should return policies filtered by category', async () => {
      const policies = [mockPolicy];
      policyRepository.find.mockResolvedValue(policies as GrcPolicy[]);

      const result = await service.findByCategory(mockTenantId, 'Security');

      expect(result).toEqual(policies);
    });
  });

  describe('getStatistics', () => {
    it('should return policy statistics for tenant', async () => {
      const policies = [
        { ...mockPolicy, status: PolicyStatus.DRAFT, category: 'Security' },
        {
          ...mockPolicy,
          id: 'policy-2',
          status: PolicyStatus.ACTIVE,
          category: 'Security',
        },
        {
          ...mockPolicy,
          id: 'policy-3',
          status: PolicyStatus.ACTIVE,
          category: 'Compliance',
        },
      ];
      policyRepository.find.mockResolvedValue(policies as GrcPolicy[]);

      const result = await service.getStatistics(mockTenantId);

      expect(result).toEqual({
        total: 3,
        byStatus: {
          [PolicyStatus.DRAFT]: 1,
          [PolicyStatus.ACTIVE]: 2,
        },
        byCategory: {
          Security: 2,
          Compliance: 1,
        },
      });
    });
  });

  describe('tenant isolation', () => {
    it('should not return policies from different tenant', async () => {
      const differentTenantId = '00000000-0000-0000-0000-000000000099';
      policyRepository.findOne.mockResolvedValue(null);

      const result = await service.findOneActiveForTenant(
        differentTenantId,
        mockPolicyId,
      );

      expect(result).toBeNull();
      expect(policyRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: mockPolicyId,
          tenantId: differentTenantId,
          isDeleted: false,
        },
      });
    });

    it('should only return policies belonging to the specified tenant', async () => {
      const tenantPolicies = [mockPolicy];
      policyRepository.find.mockResolvedValue(tenantPolicies as GrcPolicy[]);

      const result = await service.findAllActiveForTenant(mockTenantId);

      expect(result).toEqual(tenantPolicies);
      expect(policyRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: mockTenantId,
          }),
        }),
      );
    });
  });
});
