import { Test, TestingModule } from '@nestjs/testing';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from './guards/tenant.guard';
import { UserRole } from '../users/user.entity';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('TenantsController', () => {
  let controller: TenantsController;

  const mockTenantsService = {
    findAll: jest.fn(),
    findById: jest.fn(),
    getUsersForTenant: jest.fn(),
    count: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        {
          provide: TenantsService,
          useValue: mockTenantsService,
        },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TenantsController>(TenantsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Security - listTenants endpoint', () => {
    it('should have JwtAuthGuard and RolesGuard applied to listTenants', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        TenantsController.prototype.listTenants,
      );
      expect(guards).toBeDefined();
      expect(guards.length).toBe(2);
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
    });

    it('should require ADMIN role for listTenants', () => {
      const roles = Reflect.getMetadata(
        ROLES_KEY,
        TenantsController.prototype.listTenants,
      );
      expect(roles).toBeDefined();
      expect(roles).toContain(UserRole.ADMIN);
    });

    it('should return paginated list of tenants for admin users', async () => {
      const mockTenants = [
        {
          id: 'tenant-1',
          name: 'Tenant One',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'tenant-2',
          name: 'Tenant Two',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockTenantsService.findAll.mockResolvedValue(mockTenants as any);

      const result = await controller.listTenants({ page: '1', limit: '10' });

      expect(result.tenants).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });
  });

  describe('listTenants', () => {
    it('should paginate results correctly', async () => {
      const mockTenants = Array.from({ length: 25 }, (_, i) => ({
        id: `tenant-${i + 1}`,
        name: `Tenant ${i + 1}`,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      mockTenantsService.findAll.mockResolvedValue(mockTenants as any);

      const page1 = await controller.listTenants({ page: '1', limit: '10' });
      const page2 = await controller.listTenants({ page: '2', limit: '10' });
      const page3 = await controller.listTenants({ page: '3', limit: '10' });

      expect(page1.tenants).toHaveLength(10);
      expect(page2.tenants).toHaveLength(10);
      expect(page3.tenants).toHaveLength(5);
      expect(page1.pagination.totalPages).toBe(3);
    });
  });

  describe('health', () => {
    it('should return health status without authentication', async () => {
      mockTenantsService.count.mockResolvedValue(5);

      const result = await controller.health();

      expect(result.status).toBe('ok');
      expect(result.module).toBe('tenants');
      expect(result.tenantCount).toBe(5);
    });
  });
});
