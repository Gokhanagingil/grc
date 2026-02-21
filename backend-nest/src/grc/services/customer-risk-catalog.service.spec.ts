import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConflictException } from '@nestjs/common';
import { CustomerRiskCatalogService } from './customer-risk-catalog.service';
import { CustomerRiskCatalog } from '../entities/customer-risk-catalog.entity';
import { CustomerRiskBinding } from '../entities/customer-risk-binding.entity';
import { CustomerRiskObservation } from '../entities/customer-risk-observation.entity';

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const TENANT_B = '00000000-0000-0000-0000-000000000099';
const USER_ID = '00000000-0000-0000-0000-000000000002';

function mockQueryBuilder(items: unknown[] = [], total = 0) {
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(items),
    getCount: jest.fn().mockResolvedValue(total),
  };
  return qb;
}

function mockRepository() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((data: Record<string, unknown>) => ({ id: 'mock-id', ...data })),
    save: jest.fn((entity: Record<string, unknown>) => Promise.resolve({ id: 'mock-id', ...entity })),
    count: jest.fn().mockResolvedValue(0),
    merge: jest.fn((existing: Record<string, unknown>, data: Record<string, unknown>) => ({ ...existing, ...data })),
    createQueryBuilder: jest.fn(),
  };
}

describe('CustomerRiskCatalogService', () => {
  let service: CustomerRiskCatalogService;
  let catalogRepo: ReturnType<typeof mockRepository>;
  let bindingRepo: ReturnType<typeof mockRepository>;
  let observationRepo: ReturnType<typeof mockRepository>;
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    catalogRepo = mockRepository();
    bindingRepo = mockRepository();
    observationRepo = mockRepository();
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerRiskCatalogService,
        { provide: getRepositoryToken(CustomerRiskCatalog), useValue: catalogRepo },
        { provide: getRepositoryToken(CustomerRiskBinding), useValue: bindingRepo },
        { provide: getRepositoryToken(CustomerRiskObservation), useValue: observationRepo },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<CustomerRiskCatalogService>(CustomerRiskCatalogService);
  });

  describe('createCatalogRisk', () => {
    it('should create a catalog risk and emit event', async () => {
      const data = {
        title: 'OS End-of-Support',
        category: 'OS_LIFECYCLE',
        signalType: 'STATIC_FLAG',
        severity: 'CRITICAL',
      } as Partial<CustomerRiskCatalog>;

      const result = await service.createCatalogRisk(TENANT_A, USER_ID, data);
      expect(result).toBeDefined();
      expect(result.tenantId).toBe(TENANT_A);
      expect(catalogRepo.create).toHaveBeenCalled();
      expect(catalogRepo.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'customer-risk-catalog.created',
        expect.objectContaining({ tenantId: TENANT_A }),
      );
    });
  });

  describe('findOneActiveForTenant', () => {
    it('should return risk for correct tenant', async () => {
      const mockRisk = { id: 'risk-1', tenantId: TENANT_A, isDeleted: false };
      catalogRepo.findOne.mockResolvedValue(mockRisk);

      const result = await service.findOneActiveForTenant(TENANT_A, 'risk-1');
      expect(result).toBeDefined();
      expect(catalogRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'risk-1', tenantId: TENANT_A, isDeleted: false },
      });
    });

    it('should return null for wrong tenant', async () => {
      catalogRepo.findOne.mockResolvedValue(null);

      const result = await service.findOneActiveForTenant(TENANT_B, 'risk-1');
      expect(result).toBeNull();
    });
  });

  describe('softDeleteCatalogRisk', () => {
    it('should soft delete and emit event', async () => {
      const mockRisk = { id: 'risk-1', tenantId: TENANT_A, isDeleted: false };
      catalogRepo.findOne
        .mockResolvedValueOnce(mockRisk)
        .mockResolvedValueOnce(mockRisk);

      const result = await service.softDeleteCatalogRisk(TENANT_A, USER_ID, 'risk-1');
      expect(result).toBe(true);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'customer-risk-catalog.deleted',
        expect.objectContaining({ id: 'risk-1', tenantId: TENANT_A }),
      );
    });

    it('should return false if risk not found', async () => {
      catalogRepo.findOne.mockResolvedValue(null);
      const result = await service.softDeleteCatalogRisk(TENANT_A, USER_ID, 'nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('findWithFilters', () => {
    it('should apply status filter', async () => {
      const qb = mockQueryBuilder([], 0);
      catalogRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findWithFilters(TENANT_A, { status: 'ACTIVE' } as never);
      expect(qb.andWhere).toHaveBeenCalledWith('cr.status = :status', { status: 'ACTIVE' });
    });

    it('should apply search filter with ILIKE', async () => {
      const qb = mockQueryBuilder([], 0);
      catalogRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findWithFilters(TENANT_A, { search: 'OS' } as never);
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(cr.title ILIKE :search OR cr.description ILIKE :search OR cr.code ILIKE :search)',
        { search: '%OS%' },
      );
    });

    it('should return paginated response', async () => {
      const items = [{ id: '1' }, { id: '2' }];
      const qb = mockQueryBuilder(items, 5);
      catalogRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findWithFilters(TENANT_A, { page: 1, pageSize: 2 } as never);
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
      expect(result.totalPages).toBe(3);
    });
  });

  describe('createBinding', () => {
    it('should throw ConflictException if catalog risk not found', async () => {
      catalogRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createBinding(TENANT_A, USER_ID, 'nonexistent', {
          targetType: 'CI',
          targetId: 'ci-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException on duplicate binding', async () => {
      catalogRepo.findOne.mockResolvedValue({ id: 'risk-1', tenantId: TENANT_A });
      bindingRepo.findOne.mockResolvedValue({ id: 'existing-binding' });

      await expect(
        service.createBinding(TENANT_A, USER_ID, 'risk-1', {
          targetType: 'CI',
          targetId: 'ci-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create binding successfully and emit event', async () => {
      catalogRepo.findOne.mockResolvedValue({ id: 'risk-1', tenantId: TENANT_A });
      bindingRepo.findOne.mockResolvedValue(null);

      const result = await service.createBinding(TENANT_A, USER_ID, 'risk-1', {
        targetType: 'CI',
        targetId: 'ci-1',
        scopeMode: 'DIRECT',
      });

      expect(result).toBeDefined();
      expect(bindingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_A,
          catalogRiskId: 'risk-1',
          targetType: 'CI',
          targetId: 'ci-1',
          scopeMode: 'DIRECT',
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'customer-risk-binding.created',
        expect.objectContaining({ catalogRiskId: 'risk-1' }),
      );
    });
  });

  describe('deleteBinding', () => {
    it('should soft delete binding', async () => {
      const mockBinding = { id: 'binding-1', tenantId: TENANT_A, isDeleted: false };
      bindingRepo.findOne.mockResolvedValue(mockBinding);

      const result = await service.deleteBinding(TENANT_A, 'risk-1', 'binding-1');
      expect(result).toBe(true);
      expect(bindingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isDeleted: true }),
      );
    });

    it('should return false if binding not found', async () => {
      bindingRepo.findOne.mockResolvedValue(null);
      const result = await service.deleteBinding(TENANT_A, 'risk-1', 'nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('findObservations', () => {
    it('should apply filters', async () => {
      const qb = mockQueryBuilder([], 0);
      observationRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findObservations(TENANT_A, {
        status: 'OPEN',
        evidenceType: 'MANUAL',
      } as never);

      expect(qb.andWhere).toHaveBeenCalledWith('o.status = :status', { status: 'OPEN' });
      expect(qb.andWhere).toHaveBeenCalledWith('o.evidenceType = :evidenceType', { evidenceType: 'MANUAL' });
    });
  });

  describe('findBindingsForTarget', () => {
    it('should find active bindings with catalogRisk relation', async () => {
      await service.findBindingsForTarget(TENANT_A, 'CI', 'ci-1');
      expect(bindingRepo.find).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_A,
          targetType: 'CI',
          targetId: 'ci-1',
          enabled: true,
          isDeleted: false,
        },
        relations: ['catalogRisk'],
      });
    });
  });
});
