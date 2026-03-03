import { Test, TestingModule } from '@nestjs/testing';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { RequestWithUser } from '../common/types';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../auth/permissions/permissions.guard';

describe('GroupsController', () => {
  let controller: GroupsController;
  let service: Partial<Record<keyof GroupsService, jest.Mock>>;

  const createMockRequest = (
    tenantId: string,
    userId = 'user-1',
    role = 'admin',
  ): RequestWithUser =>
    ({
      tenantId,
      user: {
        sub: userId,
        email: 'test@example.com',
        role,
      },
    }) as RequestWithUser;

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      findOne: jest.fn().mockResolvedValue({
        id: 'g1',
        name: 'Test Group',
        tenantId: 'tenant-1',
        isActive: true,
      }),
      create: jest.fn().mockResolvedValue({
        id: 'g1',
        name: 'New Group',
        tenantId: 'tenant-1',
      }),
      update: jest.fn().mockResolvedValue({
        id: 'g1',
        name: 'Updated',
        tenantId: 'tenant-1',
      }),
      remove: jest.fn().mockResolvedValue(true),
      getMembers: jest.fn().mockResolvedValue([]),
      addMember: jest.fn().mockResolvedValue({
        id: 'm1',
        groupId: 'g1',
        userId: 'u1',
        tenantId: 'tenant-1',
      }),
      removeMember: jest.fn().mockResolvedValue(true),
      getGroupUserIds: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GroupsController],
      providers: [
        Reflector,
        { provide: GroupsService, useValue: service },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<GroupsController>(GroupsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('directory', () => {
    it('should return groups with limited fields for any authenticated user', async () => {
      const req = createMockRequest('tenant-1');
      service.findAll!.mockResolvedValue({
        items: [
          {
            id: 'g1',
            tenantId: 'tenant-1',
            name: 'Engineering',
            description: 'Eng team',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      });

      const result = await controller.directory(req, {});
      expect(result.items).toEqual([
        { id: 'g1', name: 'Engineering', description: 'Eng team', isActive: true },
      ]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });
  });

  describe('getMembers', () => {
    it('should return members with expanded user info', async () => {
      const req = createMockRequest('tenant-1');
      service.getMembers!.mockResolvedValue([
        {
          id: 'm1',
          groupId: 'g1',
          userId: 'u1',
          tenantId: 'tenant-1',
          createdAt: new Date(),
          user: {
            id: 'u1',
            email: 'alice@example.com',
            firstName: 'Alice',
            lastName: 'Smith',
          },
        },
        {
          id: 'm2',
          groupId: 'g1',
          userId: 'u2',
          tenantId: 'tenant-1',
          createdAt: new Date(),
          user: undefined, // user not found in DB
        },
      ]);

      const result = await controller.getMembers(req, 'g1');
      expect(result).toHaveLength(2);

      // First member should have user details
      expect(result[0].user).toEqual({
        id: 'u1',
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Smith',
      });

      // Second member should have no user details (graceful fallback)
      expect(result[1].user).toBeUndefined();
      expect(result[1].userId).toBe('u2');
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with tenantId and query', async () => {
      const req = createMockRequest('tenant-1');
      await controller.findAll(req, { search: 'eng' });
      expect(service.findAll).toHaveBeenCalledWith('tenant-1', { search: 'eng' });
    });
  });

  describe('create', () => {
    it('should call service.create', async () => {
      const req = createMockRequest('tenant-1');
      const dto = { name: 'New Group' };
      await controller.create(req, dto);
      expect(service.create).toHaveBeenCalledWith('tenant-1', dto);
    });
  });

  describe('addMember', () => {
    it('should call service.addMember', async () => {
      const req = createMockRequest('tenant-1');
      await controller.addMember(req, 'g1', { userId: 'u1' });
      expect(service.addMember).toHaveBeenCalledWith('tenant-1', 'g1', 'u1');
    });
  });

  describe('removeMember', () => {
    it('should call service.removeMember', async () => {
      const req = createMockRequest('tenant-1');
      await controller.removeMember(req, 'g1', 'u1');
      expect(service.removeMember).toHaveBeenCalledWith('tenant-1', 'g1', 'u1');
    });
  });
});
