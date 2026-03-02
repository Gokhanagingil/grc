import { Test, TestingModule } from '@nestjs/testing';
import { TodosController } from './todos.controller';
import { TodosService } from './todos.service';
import { RequestWithUser } from '../common/types';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/guards/tenant.guard';

describe('TodosController', () => {
  let controller: TodosController;
  let service: Partial<Record<keyof TodosService, jest.Mock>>;

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
    service = {
      listTasks: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      }),
      getTask: jest.fn().mockResolvedValue({ id: 'task-1', title: 'Test' }),
      createTask: jest
        .fn()
        .mockResolvedValue({ id: 'task-1', title: 'New Task' }),
      updateTask: jest
        .fn()
        .mockResolvedValue({ id: 'task-1', title: 'Updated' }),
      deleteTask: jest.fn().mockResolvedValue(undefined),
      moveTask: jest
        .fn()
        .mockResolvedValue({ id: 'task-1', status: 'doing' }),
      getTaskStats: jest.fn().mockResolvedValue({
        total: 0,
        todo: 0,
        doing: 0,
        done: 0,
        overdue: 0,
      }),
      listBoards: jest.fn().mockResolvedValue([]),
      getBoard: jest
        .fn()
        .mockResolvedValue({ id: 'board-1', name: 'Test Board' }),
      createBoard: jest
        .fn()
        .mockResolvedValue({ id: 'board-1', name: 'New Board' }),
      updateBoard: jest
        .fn()
        .mockResolvedValue({ id: 'board-1', name: 'Updated Board' }),
      replaceColumns: jest.fn().mockResolvedValue([]),
      getBoardColumns: jest.fn().mockResolvedValue([]),
      seedDefaultBoard: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TodosController],
      providers: [
        Reflector,
        { provide: TodosService, useValue: service },
      ],
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

  describe('list', () => {
    it('should call todosService.listTasks with tenantId and filters', async () => {
      const req = createMockRequest('tenant-1');
      await controller.list(
        req,
        undefined,
        'todo',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        '1',
        '20',
      );
      expect(service.listTasks).toHaveBeenCalledWith('tenant-1', {
        boardId: undefined,
        status: 'todo',
        assigneeUserId: undefined,
        priority: undefined,
        dueDateFrom: undefined,
        dueDateTo: undefined,
        search: undefined,
        page: 1,
        pageSize: 20,
      });
    });

    it('should return list result from service', async () => {
      const req = createMockRequest('tenant-1');
      const mockResult = {
        items: [{ id: '1', title: 'Task' }],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      };
      service.listTasks!.mockResolvedValue(mockResult);
      const result = await controller.list(req);
      expect(result).toEqual(mockResult);
    });
  });

  describe('create', () => {
    it('should call todosService.createTask with tenantId, userId, and dto', async () => {
      const req = createMockRequest('tenant-1', 'user-42');
      const dto = { title: 'New Task' };
      await controller.create(req, dto as any);
      expect(service.createTask).toHaveBeenCalledWith(
        'tenant-1',
        'user-42',
        dto,
      );
    });
  });

  describe('findOne', () => {
    it('should call todosService.getTask with tenantId and id', async () => {
      const req = createMockRequest('tenant-1');
      await controller.findOne(req, 'task-uuid');
      expect(service.getTask).toHaveBeenCalledWith('tenant-1', 'task-uuid');
    });
  });

  describe('update', () => {
    it('should call todosService.updateTask', async () => {
      const req = createMockRequest('tenant-1', 'user-42');
      const dto = { title: 'Updated' };
      await controller.update(req, 'task-uuid', dto as any);
      expect(service.updateTask).toHaveBeenCalledWith(
        'tenant-1',
        'user-42',
        'task-uuid',
        dto,
      );
    });
  });

  describe('remove', () => {
    it('should call todosService.deleteTask', async () => {
      const req = createMockRequest('tenant-1');
      await controller.remove(req, 'task-uuid');
      expect(service.deleteTask).toHaveBeenCalledWith('tenant-1', 'task-uuid');
    });
  });

  describe('getStats', () => {
    it('should call todosService.getTaskStats with tenantId', async () => {
      const req = createMockRequest('tenant-1');
      await controller.getStats(req);
      expect(service.getTaskStats).toHaveBeenCalledWith(
        'tenant-1',
        undefined,
      );
    });

    it('should pass boardId filter', async () => {
      const req = createMockRequest('tenant-1');
      await controller.getStats(req, 'board-1');
      expect(service.getTaskStats).toHaveBeenCalledWith(
        'tenant-1',
        'board-1',
      );
    });
  });

  describe('listBoards', () => {
    it('should return boards wrapped in items/total', async () => {
      const req = createMockRequest('tenant-1');
      service.listBoards!.mockResolvedValue([
        { id: 'b1', name: 'Board 1' },
      ]);
      const result = await controller.listBoards(req);
      expect(result).toEqual({
        items: [{ id: 'b1', name: 'Board 1' }],
        total: 1,
      });
    });
  });

  describe('createBoard', () => {
    it('should call todosService.createBoard', async () => {
      const req = createMockRequest('tenant-1', 'user-42');
      const dto = { name: 'New Board' };
      await controller.createBoard(req, dto as any);
      expect(service.createBoard).toHaveBeenCalledWith(
        'tenant-1',
        'user-42',
        dto,
      );
    });
  });

  describe('getBoard', () => {
    it('should call todosService.getBoard', async () => {
      const req = createMockRequest('tenant-1');
      await controller.getBoard(req, 'board-uuid');
      expect(service.getBoard).toHaveBeenCalledWith(
        'tenant-1',
        'board-uuid',
      );
    });
  });

  describe('moveTask', () => {
    it('should call todosService.moveTask with all params', async () => {
      const req = createMockRequest('tenant-1', 'user-42');
      const dto = { toColumnKey: 'doing', toIndex: 0 };
      await controller.moveTask(req, 'board-uuid', 'task-uuid', dto);
      expect(service.moveTask).toHaveBeenCalledWith(
        'tenant-1',
        'user-42',
        'board-uuid',
        'task-uuid',
        dto,
      );
    });
  });

  describe('seed', () => {
    it('should call todosService.seedDefaultBoard and return message', async () => {
      const req = createMockRequest('tenant-1', 'user-42');
      const result = await controller.seed(req);
      expect(service.seedDefaultBoard).toHaveBeenCalledWith(
        'tenant-1',
        'user-42',
      );
      expect(result).toEqual({ message: 'Default board seeded' });
    });
  });
});
