import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TodosController } from './todos.controller';
import { RequestWithUser } from '../common/types';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/guards/tenant.guard';

describe('TodosController', () => {
  let controller: TodosController;

  const createMockRequest = (
    tenantId: string,
    userId = 'user-1',
    role = 'user',
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
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TodosController],
      providers: [Reflector],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TodosController>(TodosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Security - Guards', () => {
    it('should have JwtAuthGuard and TenantGuard applied at controller level', () => {
      const guards = Reflect.getMetadata('__guards__', TodosController);
      expect(guards).toBeDefined();
      expect(guards.length).toBe(2);
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(TenantGuard);
    });
  });

  describe('Tenant Isolation', () => {
    it('should isolate todos between tenants - tenant A cannot see tenant B todos', () => {
      const tenantA = 'tenant-a-uuid';
      const tenantB = 'tenant-b-uuid';
      const reqA = createMockRequest(tenantA);
      const reqB = createMockRequest(tenantB);

      controller.create(reqA, { title: 'Tenant A Todo' });
      controller.create(reqB, { title: 'Tenant B Todo' });

      const listA = controller.list(reqA);
      const listB = controller.list(reqB);

      expect(listA.todos).toHaveLength(1);
      expect(listA.todos[0].title).toBe('Tenant A Todo');
      expect(listB.todos).toHaveLength(1);
      expect(listB.todos[0].title).toBe('Tenant B Todo');
    });

    it('should not allow tenant A to access tenant B todo by ID', () => {
      const tenantA = 'tenant-a-uuid';
      const tenantB = 'tenant-b-uuid';
      const reqA = createMockRequest(tenantA);
      const reqB = createMockRequest(tenantB);

      const todo = controller.create(reqA, { title: 'Tenant A Todo' });

      expect(() => controller.findOne(reqB, String(todo.id))).toThrow(
        BadRequestException,
      );
    });

    it('should not allow tenant A to update tenant B todo', () => {
      const tenantA = 'tenant-a-uuid';
      const tenantB = 'tenant-b-uuid';
      const reqA = createMockRequest(tenantA);
      const reqB = createMockRequest(tenantB);

      const todo = controller.create(reqA, { title: 'Tenant A Todo' });

      expect(() =>
        controller.update(reqB, String(todo.id), { title: 'Hacked!' }),
      ).toThrow(BadRequestException);
    });

    it('should not allow tenant A to delete tenant B todo', () => {
      const tenantA = 'tenant-a-uuid';
      const tenantB = 'tenant-b-uuid';
      const reqA = createMockRequest(tenantA);
      const reqB = createMockRequest(tenantB);

      const todo = controller.create(reqA, { title: 'Tenant A Todo' });

      expect(() => controller.remove(reqB, String(todo.id))).toThrow(
        BadRequestException,
      );
    });

    it('should maintain separate ID sequences per tenant', () => {
      const tenantA = 'tenant-a-uuid';
      const tenantB = 'tenant-b-uuid';
      const reqA = createMockRequest(tenantA);
      const reqB = createMockRequest(tenantB);

      const todoA1 = controller.create(reqA, { title: 'Tenant A Todo 1' });
      const todoA2 = controller.create(reqA, { title: 'Tenant A Todo 2' });
      const todoB1 = controller.create(reqB, { title: 'Tenant B Todo 1' });

      expect(todoA1.id).toBe(1);
      expect(todoA2.id).toBe(2);
      expect(todoB1.id).toBe(1);
    });
  });

  describe('list', () => {
    it('should return empty array for new tenant', () => {
      const req = createMockRequest('test-tenant-id');
      const result = controller.list(req);
      expect(result).toEqual({ todos: [] });
    });
  });

  describe('create', () => {
    it('should create a todo with required fields', () => {
      const req = createMockRequest('test-tenant-id');
      const createDto = { title: 'Test Todo' };

      const result = controller.create(req, createDto);

      expect(result.title).toBe('Test Todo');
      expect(result.id).toBe(1);
      expect(result.status).toBe('pending');
      expect(result.priority).toBe('medium');
    });

    it('should throw BadRequestException when title is missing', () => {
      const req = createMockRequest('test-tenant-id');
      expect(() => controller.create(req, { title: '' })).toThrow(
        BadRequestException,
      );
    });
  });

  describe('findOne', () => {
    it('should return a todo by id', () => {
      const req = createMockRequest('test-tenant-id');
      controller.create(req, { title: 'Test Todo' });

      const result = controller.findOne(req, '1');

      expect(result.title).toBe('Test Todo');
    });

    it('should throw BadRequestException when todo not found', () => {
      const req = createMockRequest('test-tenant-id');
      expect(() => controller.findOne(req, '999')).toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update a todo', () => {
      const req = createMockRequest('test-tenant-id');
      controller.create(req, { title: 'Original Title' });

      const result = controller.update(req, '1', { title: 'Updated Title' });

      expect(result.title).toBe('Updated Title');
    });
  });

  describe('remove', () => {
    it('should remove a todo', () => {
      const req = createMockRequest('test-tenant-id');
      controller.create(req, { title: 'Test Todo' });

      controller.remove(req, '1');

      const list = controller.list(req);
      expect(list.todos).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      const req = createMockRequest('test-tenant-id');
      controller.create(req, { title: 'Todo 1', status: 'pending' });
      controller.create(req, { title: 'Todo 2', status: 'completed' });
      controller.create(req, { title: 'Todo 3', status: 'in_progress' });

      const stats = controller.getStats(req);

      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.in_progress).toBe(1);
    });

    it('should return stats only for the requesting tenant', () => {
      const tenantA = 'tenant-a-uuid';
      const tenantB = 'tenant-b-uuid';
      const reqA = createMockRequest(tenantA);
      const reqB = createMockRequest(tenantB);

      controller.create(reqA, { title: 'Tenant A Todo 1' });
      controller.create(reqA, { title: 'Tenant A Todo 2' });
      controller.create(reqB, { title: 'Tenant B Todo 1' });

      const statsA = controller.getStats(reqA);
      const statsB = controller.getStats(reqB);

      expect(statsA.total).toBe(2);
      expect(statsB.total).toBe(1);
    });
  });
});
