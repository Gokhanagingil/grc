import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TodosController } from './todos.controller';

describe('TodosController', () => {
  let controller: TodosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TodosController],
    }).compile();

    controller = module.get<TodosController>(TodosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('list', () => {
    it('should return empty array for new tenant', () => {
      const result = controller.list('test-tenant-id');
      expect(result).toEqual({ todos: [] });
    });

    it('should throw BadRequestException when tenant ID is missing', () => {
      expect(() => controller.list('')).toThrow(BadRequestException);
    });
  });

  describe('create', () => {
    it('should create a todo with required fields', () => {
      const tenantId = 'test-tenant-id';
      const createDto = { title: 'Test Todo' };
      
      const result = controller.create(tenantId, createDto);
      
      expect(result.title).toBe('Test Todo');
      expect(result.id).toBe(1);
      expect(result.status).toBe('pending');
      expect(result.priority).toBe('medium');
    });

    it('should throw BadRequestException when title is missing', () => {
      expect(() => controller.create('test-tenant-id', { title: '' })).toThrow(BadRequestException);
    });

    it('should throw BadRequestException when tenant ID is missing', () => {
      expect(() => controller.create('', { title: 'Test' })).toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return a todo by id', () => {
      const tenantId = 'test-tenant-id';
      controller.create(tenantId, { title: 'Test Todo' });
      
      const result = controller.findOne(tenantId, '1');
      
      expect(result.title).toBe('Test Todo');
    });

    it('should throw BadRequestException when todo not found', () => {
      expect(() => controller.findOne('test-tenant-id', '999')).toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update a todo', () => {
      const tenantId = 'test-tenant-id';
      controller.create(tenantId, { title: 'Original Title' });
      
      const result = controller.update(tenantId, '1', { title: 'Updated Title' });
      
      expect(result.title).toBe('Updated Title');
    });
  });

  describe('remove', () => {
    it('should remove a todo', () => {
      const tenantId = 'test-tenant-id';
      controller.create(tenantId, { title: 'Test Todo' });
      
      controller.remove(tenantId, '1');
      
      const list = controller.list(tenantId);
      expect(list.todos).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      const tenantId = 'test-tenant-id';
      controller.create(tenantId, { title: 'Todo 1', status: 'pending' });
      controller.create(tenantId, { title: 'Todo 2', status: 'completed' });
      controller.create(tenantId, { title: 'Todo 3', status: 'in_progress' });
      
      const stats = controller.getStats(tenantId);
      
      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.in_progress).toBe(1);
    });
  });
});
