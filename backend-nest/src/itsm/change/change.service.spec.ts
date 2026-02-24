import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChangeService } from './change.service';
import {
  ItsmChange,
  ChangeType,
  ChangeState,
  ChangeRisk,
  ChangeApprovalStatus,
} from './change.entity';
import { AuditService } from '../../audit/audit.service';
import { ApprovalService } from './approval/approval.service';
import { ChangeFilterDto } from './dto/change-filter.dto';

describe('ChangeService', () => {
  let service: ChangeService;
  let repository: jest.Mocked<Repository<ItsmChange>>;
  let auditService: jest.Mocked<AuditService>;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';
  const mockUserId = '00000000-0000-0000-0000-000000000002';

  const mockChange: Partial<ItsmChange> = {
    id: '00000000-0000-0000-0000-000000000020',
    tenantId: mockTenantId,
    number: 'CHG000001',
    title: 'Upgrade database server',
    description: 'Upgrade PostgreSQL from 14 to 16',
    type: ChangeType.NORMAL,
    state: ChangeState.DRAFT,
    risk: ChangeRisk.MEDIUM,
    approvalStatus: ChangeApprovalStatus.NOT_REQUESTED,
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

    const mockApprovalService = {
      checkTransitionGate: jest.fn().mockResolvedValue({ allowed: true }),
      requestApproval: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
      listApprovals: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangeService,
        { provide: getRepositoryToken(ItsmChange), useValue: mockRepository },
        { provide: ApprovalService, useValue: mockApprovalService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ChangeService>(ChangeService);
    repository = module.get(getRepositoryToken(ItsmChange));
    auditService = module.get(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createChange', () => {
    it('should create a new change with auto-generated number', async () => {
      const createData = {
        title: 'Upgrade database server',
        description: 'Upgrade PostgreSQL from 14 to 16',
        type: ChangeType.NORMAL,
        risk: ChangeRisk.MEDIUM,
      };

      repository.count.mockResolvedValue(0);
      repository.create.mockReturnValue({
        ...createData,
        id: '00000000-0000-0000-0000-000000000020',
        tenantId: mockTenantId,
        number: 'CHG000001',
        state: ChangeState.DRAFT,
        approvalStatus: ChangeApprovalStatus.NOT_REQUESTED,
        createdBy: mockUserId,
        isDeleted: false,
      } as ItsmChange);
      repository.save.mockResolvedValue({
        ...createData,
        id: '00000000-0000-0000-0000-000000000020',
        tenantId: mockTenantId,
        number: 'CHG000001',
        state: ChangeState.DRAFT,
        approvalStatus: ChangeApprovalStatus.NOT_REQUESTED,
        createdBy: mockUserId,
        isDeleted: false,
      } as ItsmChange);

      const result = await service.createChange(
        mockTenantId,
        mockUserId,
        createData,
      );

      expect(result).toBeDefined();
      expect(result.number).toBe('CHG000001');
      expect(auditService.recordCreate).toHaveBeenCalled();
    });
  });

  describe('findOneActiveForTenant', () => {
    it('should return change when found and not deleted', async () => {
      repository.findOne.mockResolvedValue(mockChange as ItsmChange);

      const result = await service.findOneActiveForTenant(
        mockTenantId,
        mockChange.id!,
      );

      expect(result).toEqual(mockChange);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockChange.id, tenantId: mockTenantId, isDeleted: false },
      });
    });

    it('should return null when change not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findOneActiveForTenant(
        mockTenantId,
        'non-existent',
      );

      expect(result).toBeNull();
    });
  });

  describe('updateChange', () => {
    it('should update change', async () => {
      repository.findOne.mockResolvedValue(mockChange as ItsmChange);
      repository.save.mockResolvedValue({
        ...mockChange,
        state: ChangeState.ASSESS,
      } as ItsmChange);

      const result = await service.updateChange(
        mockTenantId,
        mockUserId,
        mockChange.id!,
        {
          state: ChangeState.ASSESS,
        },
      );

      expect(result).toBeDefined();
      expect(auditService.recordUpdate).toHaveBeenCalled();
    });

    it('should return null when change not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.updateChange(
        mockTenantId,
        mockUserId,
        'non-existent',
        {
          title: 'Updated',
        },
      );

      expect(result).toBeNull();
    });
  });

  describe('softDeleteChange', () => {
    it('should soft delete change', async () => {
      repository.findOne.mockResolvedValue(mockChange as ItsmChange);
      repository.save.mockResolvedValue({
        ...mockChange,
        isDeleted: true,
      } as ItsmChange);

      const result = await service.softDeleteChange(
        mockTenantId,
        mockUserId,
        mockChange.id!,
      );

      expect(result).toBe(true);
      expect(auditService.recordDelete).toHaveBeenCalled();
    });

    it('should return false when change not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.softDeleteChange(
        mockTenantId,
        mockUserId,
        'non-existent',
      );

      expect(result).toBe(false);
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
        getMany: jest.fn().mockResolvedValue([mockChange]),
      };

      repository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as unknown as ReturnType<
          Repository<ItsmChange>['createQueryBuilder']
        >,
      );

      const result = await service.findWithFilters(mockTenantId, {
        page: 1,
        pageSize: 20,
        state: ChangeState.DRAFT,
      } as ChangeFilterDto);

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

      repository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as unknown as ReturnType<
          Repository<ItsmChange>['createQueryBuilder']
        >,
      );

      await service.findWithFilters(mockTenantId, {
        q: 'database',
      } as ChangeFilterDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.objectContaining({ search: '%database%' }),
      );
    });
  });
});
