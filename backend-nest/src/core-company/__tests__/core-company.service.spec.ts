import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { CoreCompanyService } from '../core-company.service';
import { CoreCompany } from '../core-company.entity';
import { CompanyType, CompanyStatus } from '../core-company.enum';
import { CompanyFilterDto } from '../dto/company-filter.dto';

function makeFilterDto(
  overrides: Partial<CompanyFilterDto> = {},
): CompanyFilterDto {
  const dto = Object.assign(new CompanyFilterDto(), {
    page: 1,
    pageSize: 20,
    ...overrides,
  });
  return dto;
}

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';

const mockCompany: Partial<CoreCompany> = {
  id: 'company-uuid-1',
  tenantId: TENANT_ID,
  name: 'Test Company',
  code: 'TEST-01',
  type: CompanyType.CUSTOMER,
  status: CompanyStatus.ACTIVE,
  domain: 'test.com',
  country: 'Germany',
  notes: null,
  isDeleted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: USER_ID,
  updatedBy: null,
};

describe('CoreCompanyService', () => {
  let service: CoreCompanyService;

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(1),
    getMany: jest.fn().mockResolvedValue([mockCompany]),
    getOne: jest.fn().mockResolvedValue(null),
  };

  const mockRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    merge: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoreCompanyService,
        {
          provide: getRepositoryToken(CoreCompany),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<CoreCompanyService>(CoreCompanyService);

    jest.clearAllMocks();
    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCompany', () => {
    it('should create a company without code', async () => {
      const dto = { name: 'New Company', type: CompanyType.VENDOR };
      const created = { ...mockCompany, ...dto, id: 'new-uuid' };

      mockRepository.create.mockReturnValue(created);
      mockRepository.save.mockResolvedValue(created);

      const result = await service.createCompany(TENANT_ID, USER_ID, dto);

      expect(result).toBeDefined();
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should check code uniqueness when code is provided', async () => {
      const dto = { name: 'New Company', code: 'UNIQUE-01' };

      mockQueryBuilder.getOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({ ...mockCompany, ...dto });
      mockRepository.save.mockResolvedValue({ ...mockCompany, ...dto });

      await service.createCompany(TENANT_ID, USER_ID, dto);

      // Should have called createQueryBuilder to check code uniqueness
      expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate code', async () => {
      const dto = { name: 'Duplicate', code: 'DUPE-01' };

      mockQueryBuilder.getOne.mockResolvedValue(mockCompany);

      await expect(
        service.createCompany(TENANT_ID, USER_ID, dto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findWithFilters', () => {
    it('should return paginated results', async () => {
      const filterDto = makeFilterDto();

      const result = await service.findWithFilters(TENANT_ID, filterDto);

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('pageSize');
      expect(result).toHaveProperty('totalPages');
      expect(result.items).toHaveLength(1);
    });

    it('should apply search filter', async () => {
      const filterDto = makeFilterDto({ search: 'test' });

      await service.findWithFilters(TENANT_ID, filterDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(company.name ILIKE :search OR company.code ILIKE :search)',
        { search: '%test%' },
      );
    });

    it('should apply type filter', async () => {
      const filterDto = makeFilterDto({ type: CompanyType.CUSTOMER });

      await service.findWithFilters(TENANT_ID, filterDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'company.type = :type',
        { type: CompanyType.CUSTOMER },
      );
    });

    it('should apply status filter', async () => {
      const filterDto = makeFilterDto({ status: CompanyStatus.ACTIVE });

      await service.findWithFilters(TENANT_ID, filterDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'company.status = :status',
        { status: CompanyStatus.ACTIVE },
      );
    });
  });

  describe('findOneActiveForTenant', () => {
    it('should find an active company', async () => {
      mockRepository.findOne.mockResolvedValue(mockCompany);

      const result = await service.findOneActiveForTenant(
        TENANT_ID,
        'company-uuid-1',
      );

      expect(result).toEqual(mockCompany);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'company-uuid-1', tenantId: TENANT_ID, isDeleted: false },
      });
    });

    it('should return null for non-existent company', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findOneActiveForTenant(
        TENANT_ID,
        'non-existent',
      );

      expect(result).toBeNull();
    });
  });

  describe('lookup', () => {
    it('should filter by tenantId, ACTIVE status, and return minimal payload', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([
        { id: 'c1', name: 'Acme', type: CompanyType.CUSTOMER, status: CompanyStatus.ACTIVE, code: 'ACM' },
      ]);

      const result = await service.lookup(TENANT_ID, { type: CompanyType.CUSTOMER, limit: 50 });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('company.tenantId = :tenantId', { tenantId: TENANT_ID });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('company.isDeleted = :isDeleted', { isDeleted: false });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('company.status = :status', {
        status: CompanyStatus.ACTIVE,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('company.type = :type', { type: CompanyType.CUSTOMER });
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(50);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: 'c1', name: 'Acme', type: CompanyType.CUSTOMER, status: CompanyStatus.ACTIVE, code: 'ACM' });
    });

    it('should not leak other tenants data', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.lookup(TENANT_ID, {});

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('company.tenantId = :tenantId', { tenantId: TENANT_ID });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('company.status = :status', {
        status: CompanyStatus.ACTIVE,
      });
    });
  });

  describe('softDeleteCompany', () => {
    it('should return false when company not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.softDeleteCompany(
        TENANT_ID,
        USER_ID,
        'non-existent',
      );

      expect(result).toBe(false);
    });
  });
});
