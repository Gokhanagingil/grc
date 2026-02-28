import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItsmServiceService } from './service.service';
import {
  ItsmService,
  ServiceCriticality,
  ServiceStatus,
} from './service.entity';
import { AuditService } from '../../audit/audit.service';
import { ServiceFilterDto } from './dto/service-filter.dto';

describe('ItsmServiceService', () => {
  let service: ItsmServiceService;
  let repository: jest.Mocked<Repository<ItsmService>>;
  let auditService: jest.Mocked<AuditService>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';
  const mockUserId = '00000000-0000-0000-0000-000000000002';

  const mockService: Partial<ItsmService> = {
    id: '00000000-0000-0000-0000-000000000010',
    tenantId: mockTenantId,
    name: 'Email Service',
    description: 'Corporate email service',
    criticality: ServiceCriticality.HIGH,
    status: ServiceStatus.ACTIVE,
    ownerUserId: null,
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
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
      merge: jest
        .fn()
        .mockImplementation((entity, data) => ({ ...entity, ...data })),
    };

    const mockAuditService = {
      recordCreate: jest.fn(),
      recordUpdate: jest.fn(),
      recordDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItsmServiceService,
        { provide: getRepositoryToken(ItsmService), useValue: mockRepository },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ItsmServiceService>(ItsmServiceService);
    repository = module.get(getRepositoryToken(ItsmService));
    auditService = module.get(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createService', () => {
    it('should create a new service', async () => {
      const createData = {
        name: 'Email Service',
        description: 'Corporate email service',
        criticality: ServiceCriticality.HIGH,
      };

      repository.create.mockReturnValue({
        ...createData,
        id: '00000000-0000-0000-0000-000000000010',
        tenantId: mockTenantId,
        status: ServiceStatus.ACTIVE,
        createdBy: mockUserId,
        isDeleted: false,
      } as ItsmService);
      repository.save.mockResolvedValue({
        ...createData,
        id: '00000000-0000-0000-0000-000000000010',
        tenantId: mockTenantId,
        status: ServiceStatus.ACTIVE,
        createdBy: mockUserId,
        isDeleted: false,
      } as ItsmService);

      const result = await service.createService(
        mockTenantId,
        mockUserId,
        createData,
      );

      expect(result).toBeDefined();
      expect(result.name).toBe('Email Service');
      expect(auditService.recordCreate).toHaveBeenCalled();
    });
  });

  describe('findOneActiveForTenant', () => {
    it('should return service when found and not deleted', async () => {
      repository.findOne.mockResolvedValue(mockService as ItsmService);

      const result = await service.findOneActiveForTenant(
        mockTenantId,
        mockService.id!,
      );

      expect(result).toEqual(mockService);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockService.id, tenantId: mockTenantId, isDeleted: false },
        relations: ['customerCompany'],
      });
    });

    it('should return null when service not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findOneActiveForTenant(
        mockTenantId,
        'non-existent',
      );

      expect(result).toBeNull();
    });
  });

  describe('updateService', () => {
    it('should update service', async () => {
      repository.findOne.mockResolvedValue(mockService as ItsmService);
      repository.save.mockResolvedValue({
        ...mockService,
        name: 'Updated Email Service',
      } as ItsmService);

      const result = await service.updateService(
        mockTenantId,
        mockUserId,
        mockService.id!,
        {
          name: 'Updated Email Service',
        },
      );

      expect(result).toBeDefined();
      expect(auditService.recordUpdate).toHaveBeenCalled();
    });

    it('should return null when service not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.updateService(
        mockTenantId,
        mockUserId,
        'non-existent',
        {
          name: 'Updated',
        },
      );

      expect(result).toBeNull();
    });
  });

  describe('softDeleteService', () => {
    it('should soft delete service', async () => {
      repository.findOne.mockResolvedValue(mockService as ItsmService);
      repository.save.mockResolvedValue({
        ...mockService,
        isDeleted: true,
      } as ItsmService);

      const result = await service.softDeleteService(
        mockTenantId,
        mockUserId,
        mockService.id!,
      );

      expect(result).toBe(true);
      expect(auditService.recordDelete).toHaveBeenCalled();
    });

    it('should return false when service not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.softDeleteService(
        mockTenantId,
        mockUserId,
        'non-existent',
      );

      expect(result).toBe(false);
    });
  });

  describe('findWithFilters', () => {
    it('should return paginated results', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue([mockService]),
      };

      repository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as unknown as ReturnType<
          Repository<ItsmService>['createQueryBuilder']
        >,
      );

      const result = await service.findWithFilters(mockTenantId, {
        page: 1,
        pageSize: 20,
      } as ServiceFilterDto);

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
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      };

      repository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as unknown as ReturnType<
          Repository<ItsmService>['createQueryBuilder']
        >,
      );

      await service.findWithFilters(mockTenantId, {
        q: 'email',
      } as ServiceFilterDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.objectContaining({ search: '%email%' }),
      );
    });

    it('should filter by customerCompanyId', async () => {
      const mockCompanyId = '00000000-0000-0000-0000-000000000099';
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest
          .fn()
          .mockResolvedValue([
            { ...mockService, customerCompanyId: mockCompanyId },
          ]),
      };

      repository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as unknown as ReturnType<
          Repository<ItsmService>['createQueryBuilder']
        >,
      );

      const result = await service.findWithFilters(mockTenantId, {
        customerCompanyId: mockCompanyId,
        page: 1,
        pageSize: 20,
      } as ServiceFilterDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'service.customerCompanyId = :customerCompanyId',
        { customerCompanyId: mockCompanyId },
      );
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should NOT filter by customerCompanyId when not provided', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue([mockService]),
      };

      repository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as unknown as ReturnType<
          Repository<ItsmService>['createQueryBuilder']
        >,
      );

      await service.findWithFilters(mockTenantId, {
        page: 1,
        pageSize: 20,
      } as ServiceFilterDto);

      // Verify customerCompanyId filter was NOT applied
      const andWhereCalls = mockQueryBuilder.andWhere.mock.calls;
      const companyFilterCalls = andWhereCalls.filter(
        (call: [string, Record<string, unknown>]) =>
          typeof call[0] === 'string' && call[0].includes('customerCompanyId'),
      );
      expect(companyFilterCalls).toHaveLength(0);
    });

    it('should join customerCompany relation in results', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue([mockService]),
      };

      repository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as unknown as ReturnType<
          Repository<ItsmService>['createQueryBuilder']
        >,
      );

      await service.findWithFilters(mockTenantId, {
        page: 1,
        pageSize: 20,
      } as ServiceFilterDto);

      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'service.customerCompany',
        'customerCompany',
      );
    });

    it('should enforce tenant isolation when filtering by company', async () => {
      const differentTenantId = '00000000-0000-0000-0000-000000000999';
      const mockCompanyId = '00000000-0000-0000-0000-000000000099';
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      };

      repository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as unknown as ReturnType<
          Repository<ItsmService>['createQueryBuilder']
        >,
      );

      const result = await service.findWithFilters(differentTenantId, {
        customerCompanyId: mockCompanyId,
        page: 1,
        pageSize: 20,
      } as ServiceFilterDto);

      // Verify tenant scoping is applied first
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'service.tenantId = :tenantId',
        { tenantId: differentTenantId },
      );
      // Verify company filter is also applied
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'service.customerCompanyId = :customerCompanyId',
        { customerCompanyId: mockCompanyId },
      );
      expect(result.items).toHaveLength(0);
    });
  });
});
