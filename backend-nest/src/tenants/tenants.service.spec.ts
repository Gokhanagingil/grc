import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantsService } from './tenants.service';
import { Tenant } from './tenant.entity';
import { User } from '../users/user.entity';

describe('TenantsService', () => {
  let service: TenantsService;
  let tenantRepository: jest.Mocked<Repository<Tenant>>;
  let userRepository: jest.Mocked<Repository<User>>;

  const mockTenant: Partial<Tenant> = {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Demo Organization',
    description: 'Default demo tenant for testing and development',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockTenantRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      find: jest.fn(),
    };

    const mockUserRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockTenantRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
    tenantRepository = module.get(getRepositoryToken(Tenant));
    userRepository = module.get(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrCreateDemoTenant', () => {
    it('should return existing demo tenant if it exists (idempotent)', async () => {
      // Arrange: Demo tenant already exists
      tenantRepository.findOne.mockResolvedValue(mockTenant as Tenant);

      // Act: Call getOrCreateDemoTenant twice
      const result1 = await service.getOrCreateDemoTenant();
      const result2 = await service.getOrCreateDemoTenant();

      // Assert: Should return the same tenant without creating new ones
      expect(result1).toEqual(mockTenant);
      expect(result2).toEqual(mockTenant);
      expect(tenantRepository.findOne).toHaveBeenCalledTimes(2);
      expect(tenantRepository.create).not.toHaveBeenCalled();
      expect(tenantRepository.save).not.toHaveBeenCalled();
    });

    it('should create demo tenant if it does not exist', async () => {
      // Arrange: Demo tenant does not exist
      tenantRepository.findOne.mockResolvedValue(null);
      tenantRepository.create.mockReturnValue(mockTenant as Tenant);
      tenantRepository.save.mockResolvedValue(mockTenant as Tenant);

      // Act
      const result = await service.getOrCreateDemoTenant();

      // Assert
      expect(result).toEqual(mockTenant);
      expect(tenantRepository.findOne).toHaveBeenCalledWith({
        where: { name: 'Demo Organization' },
      });
      expect(tenantRepository.create).toHaveBeenCalledWith({
        name: 'Demo Organization',
        description: 'Default demo tenant for testing and development',
      });
      expect(tenantRepository.save).toHaveBeenCalled();
    });

    it('should be idempotent - multiple calls return same tenant', async () => {
      // Arrange: First call creates, subsequent calls return existing
      tenantRepository.findOne
        .mockResolvedValueOnce(null) // First call - tenant doesn't exist
        .mockResolvedValue(mockTenant as Tenant); // Subsequent calls - tenant exists
      tenantRepository.create.mockReturnValue(mockTenant as Tenant);
      tenantRepository.save.mockResolvedValue(mockTenant as Tenant);

      // Act: Call multiple times
      const result1 = await service.getOrCreateDemoTenant();
      const result2 = await service.getOrCreateDemoTenant();
      const result3 = await service.getOrCreateDemoTenant();

      // Assert: All results should be the same tenant
      expect(result1.name).toBe('Demo Organization');
      expect(result2.name).toBe('Demo Organization');
      expect(result3.name).toBe('Demo Organization');

      // Create should only be called once (on first call)
      expect(tenantRepository.create).toHaveBeenCalledTimes(1);
      expect(tenantRepository.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('findById', () => {
    it('should return tenant when found', async () => {
      tenantRepository.findOne.mockResolvedValue(mockTenant as Tenant);

      const result = await service.findById(mockTenant.id!);

      expect(result).toEqual(mockTenant);
      expect(tenantRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockTenant.id },
      });
    });

    it('should return null when tenant not found', async () => {
      tenantRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('userBelongsToTenant', () => {
    it('should return true when user belongs to tenant', async () => {
      const mockUser: Partial<User> = {
        id: 'user-id',
        tenantId: mockTenant.id,
      };
      userRepository.findOne.mockResolvedValue(mockUser as User);

      const result = await service.userBelongsToTenant(
        'user-id',
        mockTenant.id!,
      );

      expect(result).toBe(true);
    });

    it('should return false when user does not belong to tenant', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.userBelongsToTenant(
        'user-id',
        'different-tenant',
      );

      expect(result).toBe(false);
    });
  });
});
