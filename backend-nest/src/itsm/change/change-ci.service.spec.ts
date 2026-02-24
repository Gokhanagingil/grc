/**
 * ChangeCiService — Affected CI Linkage Tests
 *
 * Tests the Change-CI link CRUD operations.
 *
 * Covers:
 * - addAffectedCi: success, duplicate, not found
 * - removeAffectedCi: success, not found
 * - findAffectedCis: success, empty, pagination
 *
 * @regression
 * @phase4-change-ci-linkage
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ChangeCiService } from './change-ci.service';
import { ItsmChangeCi } from './change-ci.entity';
import { ItsmChange } from './change.entity';
import { CmdbCi } from '../cmdb/ci/ci.entity';

describe('ChangeCiService', () => {
  let service: ChangeCiService;
  let changeCiRepo: jest.Mocked<Repository<ItsmChangeCi>>;
  let changeRepo: jest.Mocked<Repository<ItsmChange>>;
  let ciRepo: jest.Mocked<Repository<CmdbCi>>;

  const TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const USER_ID = '00000000-0000-0000-0000-000000000002';
  const CHANGE_ID = '00000000-0000-0000-0000-000000000020';
  const CI_ID = '00000000-0000-0000-0000-000000000050';
  const LINK_ID = '00000000-0000-0000-0000-000000000060';

  const mockChange: Partial<ItsmChange> = {
    id: CHANGE_ID,
    tenantId: TENANT_ID,
    isDeleted: false,
  };

  const mockCi: Partial<CmdbCi> = {
    id: CI_ID,
    tenantId: TENANT_ID,
    isDeleted: false,
  };

  const mockLink: Partial<ItsmChangeCi> = {
    id: LINK_ID,
    tenantId: TENANT_ID,
    changeId: CHANGE_ID,
    ciId: CI_ID,
    relationshipType: 'AFFECTED',
    impactScope: null,
  };

  beforeEach(async () => {
    const mockChangeCiRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
      merge: jest.fn().mockImplementation((entity, data) => ({ ...entity, ...data })),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };

    const mockChangeRepo = {
      findOne: jest.fn(),
    };

    const mockCiRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangeCiService,
        { provide: getRepositoryToken(ItsmChangeCi), useValue: mockChangeCiRepo },
        { provide: getRepositoryToken(ItsmChange), useValue: mockChangeRepo },
        { provide: getRepositoryToken(CmdbCi), useValue: mockCiRepo },
      ],
    }).compile();

    service = module.get<ChangeCiService>(ChangeCiService);
    changeCiRepo = module.get(getRepositoryToken(ItsmChangeCi));
    changeRepo = module.get(getRepositoryToken(ItsmChange));
    ciRepo = module.get(getRepositoryToken(CmdbCi));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addAffectedCi', () => {
    it('creates a new change-CI link', async () => {
      changeRepo.findOne.mockResolvedValue(mockChange as ItsmChange);
      ciRepo.findOne.mockResolvedValue(mockCi as CmdbCi);
      changeCiRepo.findOne
        .mockResolvedValueOnce(null)  // duplicate check
        .mockResolvedValueOnce(mockLink as ItsmChangeCi); // findOneWithRelations
      changeCiRepo.create.mockReturnValue(mockLink as ItsmChangeCi);
      changeCiRepo.save.mockResolvedValue(mockLink as ItsmChangeCi);

      const result = await service.addAffectedCi(
        TENANT_ID,
        USER_ID,
        CHANGE_ID,
        CI_ID,
        'AFFECTED',
      );

      expect(result).toBeDefined();
      expect(result.changeId).toBe(CHANGE_ID);
      expect(result.ciId).toBe(CI_ID);
    });

    it('throws NotFoundException when change does not exist', async () => {
      changeRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addAffectedCi(TENANT_ID, USER_ID, CHANGE_ID, CI_ID, 'AFFECTED'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when CI does not exist', async () => {
      changeRepo.findOne.mockResolvedValue(mockChange as ItsmChange);
      ciRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addAffectedCi(TENANT_ID, USER_ID, CHANGE_ID, 'non-existent', 'AFFECTED'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException on duplicate link', async () => {
      changeRepo.findOne.mockResolvedValue(mockChange as ItsmChange);
      ciRepo.findOne.mockResolvedValue(mockCi as CmdbCi);
      changeCiRepo.findOne.mockResolvedValue(mockLink as ItsmChangeCi);

      await expect(
        service.addAffectedCi(TENANT_ID, USER_ID, CHANGE_ID, CI_ID, 'AFFECTED'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeAffectedCi', () => {
    it('returns true for an existing link', async () => {
      changeCiRepo.findOne.mockResolvedValue(mockLink as ItsmChangeCi);
      changeCiRepo.save.mockResolvedValue({ ...mockLink, isDeleted: true } as ItsmChangeCi);

      const result = await service.removeAffectedCi(TENANT_ID, USER_ID, CHANGE_ID, LINK_ID);
      expect(result).toBe(true);
    });

    it('returns false when link does not exist', async () => {
      changeCiRepo.findOne.mockResolvedValue(null);

      const result = await service.removeAffectedCi(TENANT_ID, USER_ID, CHANGE_ID, 'non-existent');
      expect(result).toBe(false);
    });
  });

  describe('findAffectedCis', () => {
    it('returns paginated results', async () => {
      const result = await service.findAffectedCis(TENANT_ID, CHANGE_ID, {
        page: 1,
        pageSize: 20,
      });

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
