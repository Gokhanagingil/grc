import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { GrcFrameworksService } from './grc-frameworks.service';
import { GrcFramework } from '../entities/grc-framework.entity';
import { GrcTenantFramework } from '../entities/grc-tenant-framework.entity';

describe('GrcFrameworksService', () => {
  let service: GrcFrameworksService;
  let frameworkRepository: jest.Mocked<Repository<GrcFramework>>;
  let tenantFrameworkRepository: jest.Mocked<Repository<GrcTenantFramework>>;

  const mockTenantIdA = '00000000-0000-0000-0000-000000000001';
  const mockTenantIdB = '00000000-0000-0000-0000-000000000002';

  const mockFrameworks: Partial<GrcFramework>[] = [
    {
      id: 'framework-1',
      key: 'ISO27001',
      name: 'ISO/IEC 27001',
      description: 'Information security management',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'framework-2',
      key: 'SOC2',
      name: 'SOC 2',
      description: 'Trust Services Criteria',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'framework-3',
      key: 'NIST',
      name: 'NIST Cybersecurity Framework',
      description: 'Cybersecurity risk management',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'framework-4',
      key: 'GDPR',
      name: 'General Data Protection Regulation',
      description: 'EU data protection',
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      delete: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    },
  };

  beforeEach(async () => {
    const mockFrameworkRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const mockTenantFrameworkRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrcFrameworksService,
        {
          provide: getRepositoryToken(GrcFramework),
          useValue: mockFrameworkRepository,
        },
        {
          provide: getRepositoryToken(GrcTenantFramework),
          useValue: mockTenantFrameworkRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<GrcFrameworksService>(GrcFrameworksService);
    frameworkRepository = module.get(getRepositoryToken(GrcFramework));
    tenantFrameworkRepository = module.get(
      getRepositoryToken(GrcTenantFramework),
    );
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllActive', () => {
    it('should return only active frameworks', async () => {
      const activeFrameworks = mockFrameworks.filter((f) => f.isActive);
      frameworkRepository.find.mockResolvedValue(
        activeFrameworks as GrcFramework[],
      );

      const result = await service.findAllActive();

      expect(result).toHaveLength(3);
      expect(result.every((f) => f.isActive)).toBe(true);
      expect(frameworkRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { key: 'ASC' },
      });
    });

    it('should return empty array when no active frameworks exist', async () => {
      frameworkRepository.find.mockResolvedValue([]);

      const result = await service.findAllActive();

      expect(result).toEqual([]);
    });
  });

  describe('getTenantFrameworkKeys', () => {
    it('should return framework keys for tenant', async () => {
      const tenantFrameworks = [
        {
          id: 'tf-1',
          tenantId: mockTenantIdA,
          frameworkId: 'framework-1',
          framework: mockFrameworks[0],
        },
        {
          id: 'tf-2',
          tenantId: mockTenantIdA,
          frameworkId: 'framework-2',
          framework: mockFrameworks[1],
        },
      ];
      tenantFrameworkRepository.find.mockResolvedValue(
        tenantFrameworks as GrcTenantFramework[],
      );

      const result = await service.getTenantFrameworkKeys(mockTenantIdA);

      expect(result).toEqual(['ISO27001', 'SOC2']);
      expect(tenantFrameworkRepository.find).toHaveBeenCalledWith({
        where: { tenantId: mockTenantIdA },
        relations: ['framework'],
      });
    });

    it('should return empty array when tenant has no frameworks', async () => {
      tenantFrameworkRepository.find.mockResolvedValue([]);

      const result = await service.getTenantFrameworkKeys(mockTenantIdA);

      expect(result).toEqual([]);
    });

    it('should filter out inactive frameworks', async () => {
      const tenantFrameworks = [
        {
          id: 'tf-1',
          tenantId: mockTenantIdA,
          frameworkId: 'framework-1',
          framework: mockFrameworks[0],
        },
        {
          id: 'tf-2',
          tenantId: mockTenantIdA,
          frameworkId: 'framework-4',
          framework: mockFrameworks[3],
        },
      ];
      tenantFrameworkRepository.find.mockResolvedValue(
        tenantFrameworks as GrcTenantFramework[],
      );

      const result = await service.getTenantFrameworkKeys(mockTenantIdA);

      expect(result).toEqual(['ISO27001']);
    });

    it('should return sorted keys', async () => {
      const tenantFrameworks = [
        {
          id: 'tf-1',
          tenantId: mockTenantIdA,
          frameworkId: 'framework-2',
          framework: mockFrameworks[1],
        },
        {
          id: 'tf-2',
          tenantId: mockTenantIdA,
          frameworkId: 'framework-1',
          framework: mockFrameworks[0],
        },
      ];
      tenantFrameworkRepository.find.mockResolvedValue(
        tenantFrameworks as GrcTenantFramework[],
      );

      const result = await service.getTenantFrameworkKeys(mockTenantIdA);

      expect(result).toEqual(['ISO27001', 'SOC2']);
    });
  });

  describe('setTenantFrameworks', () => {
    it('should replace tenant frameworks with new set', async () => {
      const activeFrameworks = mockFrameworks.filter((f) => f.isActive);
      frameworkRepository.find.mockResolvedValue(
        activeFrameworks.slice(0, 2) as GrcFramework[],
      );

      mockQueryRunner.manager.create.mockImplementation((_, data) => data);
      mockQueryRunner.manager.save.mockResolvedValue({});

      tenantFrameworkRepository.find.mockResolvedValue([
        {
          id: 'tf-1',
          tenantId: mockTenantIdA,
          frameworkId: 'framework-1',
          framework: mockFrameworks[0],
        },
        {
          id: 'tf-2',
          tenantId: mockTenantIdA,
          frameworkId: 'framework-2',
          framework: mockFrameworks[1],
        },
      ] as GrcTenantFramework[]);

      const result = await service.setTenantFrameworks(mockTenantIdA, [
        'ISO27001',
        'SOC2',
      ]);

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.manager.delete).toHaveBeenCalledWith(
        GrcTenantFramework,
        { tenantId: mockTenantIdA },
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(result).toEqual(['ISO27001', 'SOC2']);
    });

    it('should throw BadRequestException for invalid framework keys', async () => {
      frameworkRepository.find.mockResolvedValue([]);

      await expect(
        service.setTenantFrameworks(mockTenantIdA, ['INVALID_KEY']),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for inactive framework keys', async () => {
      frameworkRepository.find.mockResolvedValue([]);

      await expect(
        service.setTenantFrameworks(mockTenantIdA, ['GDPR']),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle empty activeKeys array', async () => {
      frameworkRepository.find.mockResolvedValue([]);
      tenantFrameworkRepository.find.mockResolvedValue([]);

      const result = await service.setTenantFrameworks(mockTenantIdA, []);

      expect(mockQueryRunner.manager.delete).toHaveBeenCalledWith(
        GrcTenantFramework,
        { tenantId: mockTenantIdA },
      );
      expect(result).toEqual([]);
    });

    it('should deduplicate framework keys', async () => {
      const activeFrameworks = [mockFrameworks[0]];
      frameworkRepository.find.mockResolvedValue(
        activeFrameworks as GrcFramework[],
      );

      mockQueryRunner.manager.create.mockImplementation((_, data) => data);
      mockQueryRunner.manager.save.mockResolvedValue({});

      tenantFrameworkRepository.find.mockResolvedValue([
        {
          id: 'tf-1',
          tenantId: mockTenantIdA,
          frameworkId: 'framework-1',
          framework: mockFrameworks[0],
        },
      ] as GrcTenantFramework[]);

      const result = await service.setTenantFrameworks(mockTenantIdA, [
        'ISO27001',
        'ISO27001',
        'ISO27001',
      ]);

      expect(mockQueryRunner.manager.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(['ISO27001']);
    });

    it('should rollback transaction on error', async () => {
      frameworkRepository.find.mockResolvedValue([
        mockFrameworks[0],
      ] as GrcFramework[]);
      mockQueryRunner.manager.delete.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.setTenantFrameworks(mockTenantIdA, ['ISO27001']),
      ).rejects.toThrow('Database error');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('tenant isolation', () => {
    it('should only return frameworks for the specified tenant', async () => {
      const tenantAFrameworks = [
        {
          id: 'tf-1',
          tenantId: mockTenantIdA,
          frameworkId: 'framework-1',
          framework: mockFrameworks[0],
        },
      ];
      const tenantBFrameworks = [
        {
          id: 'tf-2',
          tenantId: mockTenantIdB,
          frameworkId: 'framework-2',
          framework: mockFrameworks[1],
        },
      ];

      tenantFrameworkRepository.find
        .mockResolvedValueOnce(tenantAFrameworks as GrcTenantFramework[])
        .mockResolvedValueOnce(tenantBFrameworks as GrcTenantFramework[]);

      const resultA = await service.getTenantFrameworkKeys(mockTenantIdA);
      const resultB = await service.getTenantFrameworkKeys(mockTenantIdB);

      expect(resultA).toEqual(['ISO27001']);
      expect(resultB).toEqual(['SOC2']);
    });

    it('should not affect other tenants when setting frameworks', async () => {
      mockQueryRunner.manager.delete.mockReset();
      mockQueryRunner.manager.delete.mockResolvedValue({});

      const activeFrameworks = [mockFrameworks[0]];
      frameworkRepository.find.mockResolvedValue(
        activeFrameworks as GrcFramework[],
      );

      mockQueryRunner.manager.create.mockImplementation((_, data) => data);
      mockQueryRunner.manager.save.mockResolvedValue({});

      tenantFrameworkRepository.find.mockResolvedValue([
        {
          id: 'tf-1',
          tenantId: mockTenantIdA,
          frameworkId: 'framework-1',
          framework: mockFrameworks[0],
        },
      ] as GrcTenantFramework[]);

      await service.setTenantFrameworks(mockTenantIdA, ['ISO27001']);

      expect(mockQueryRunner.manager.delete).toHaveBeenCalledWith(
        GrcTenantFramework,
        { tenantId: mockTenantIdA },
      );
    });
  });
});
