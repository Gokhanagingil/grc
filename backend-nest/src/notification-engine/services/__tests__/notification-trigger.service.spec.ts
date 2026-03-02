import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationTriggerService } from '../notification-trigger.service';
import {
  SysUserNotification,
  NotificationType,
  NotificationSeverity,
  NotificationSource,
} from '../../entities/sys-user-notification.entity';

describe('NotificationTriggerService', () => {
  let service: NotificationTriggerService;
  let repo: jest.Mocked<Partial<Repository<SysUserNotification>>>;

  beforeEach(async () => {
    repo = {
      create: jest.fn().mockImplementation((data) => ({ id: 'test-uuid', ...data })),
      save: jest.fn().mockImplementation((entity) =>
        Promise.resolve({ ...entity, id: entity.id || 'test-uuid' }),
      ),
      count: jest.fn().mockResolvedValue(3),
      manager: { query: jest.fn().mockResolvedValue([]) } as never,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationTriggerService,
        {
          provide: getRepositoryToken(SysUserNotification),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<NotificationTriggerService>(NotificationTriggerService);
  });

  describe('createNotification', () => {
    it('should create a notification with all fields', async () => {
      const payload = {
        tenantId: '00000000-0000-0000-0000-000000000001',
        userId: '00000000-0000-0000-0000-000000000002',
        title: 'Test Title',
        body: 'Test body message',
        type: NotificationType.ASSIGNMENT,
        severity: NotificationSeverity.INFO,
        source: NotificationSource.TODO,
        entityType: 'todo_task',
        entityId: '00000000-0000-0000-0000-000000000003',
      };

      const result = await service.createNotification(payload);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: payload.tenantId,
          userId: payload.userId,
          title: payload.title,
          body: payload.body,
          type: NotificationType.ASSIGNMENT,
          severity: NotificationSeverity.INFO,
          source: NotificationSource.TODO,
          entityType: 'todo_task',
          entityId: '00000000-0000-0000-0000-000000000003',
        }),
      );
      expect(repo.save).toHaveBeenCalled();
      expect(result.title).toBe('Test Title');
    });

    it('should auto-generate link from entityType and entityId', async () => {
      const payload = {
        tenantId: '00000000-0000-0000-0000-000000000001',
        userId: '00000000-0000-0000-0000-000000000002',
        title: 'Task Assigned',
        body: 'Assigned to you',
        type: NotificationType.ASSIGNMENT,
        severity: NotificationSeverity.INFO,
        source: NotificationSource.TODO,
        entityType: 'todo_task',
        entityId: 'task-123',
      };

      await service.createNotification(payload);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          link: '/todo_task/task-123',
        }),
      );
    });

    it('should use explicit link when provided', async () => {
      const payload = {
        tenantId: '00000000-0000-0000-0000-000000000001',
        userId: '00000000-0000-0000-0000-000000000002',
        title: 'Custom Link',
        body: 'With custom link',
        type: NotificationType.GENERAL,
        severity: NotificationSeverity.INFO,
        source: NotificationSource.SYSTEM,
        link: '/custom/path',
      };

      await service.createNotification(payload);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          link: '/custom/path',
        }),
      );
    });
  });

  describe('notifyTaskAssignment', () => {
    it('should create an ASSIGNMENT notification for todo tasks', async () => {
      await service.notifyTaskAssignment(
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        'task-id-1',
        'Fix the bug',
        'Alice',
      );

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.ASSIGNMENT,
          severity: NotificationSeverity.INFO,
          source: NotificationSource.TODO,
          entityType: 'todo_task',
          entityId: 'task-id-1',
          title: 'Task Assigned',
        }),
      );

      // Check body contains task title and assigner
      const createArg = (repo.create as jest.Mock).mock.calls[0][0];
      expect(createArg.body).toContain('Fix the bug');
      expect(createArg.body).toContain('Alice');

      // Check actions include OPEN_RECORD
      expect(createArg.actions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actionType: 'OPEN_RECORD',
            payload: expect.objectContaining({ entityType: 'todo_task', entityId: 'task-id-1' }),
          }),
        ]),
      );
    });

    it('should work without assignedByName', async () => {
      await service.notifyTaskAssignment(
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        'task-id-2',
        'Review the PR',
      );

      const createArg = (repo.create as jest.Mock).mock.calls[0][0];
      expect(createArg.body).toContain('Review the PR');
      expect(createArg.body).not.toContain('by');
    });
  });

  describe('notifyDueDateApproaching', () => {
    it('should create a DUE_DATE notification with WARNING severity', async () => {
      const dueDate = new Date('2026-03-05T12:00:00Z');

      await service.notifyDueDateApproaching(
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        'task-id-3',
        'Deploy feature',
        dueDate,
      );

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.DUE_DATE,
          severity: NotificationSeverity.WARNING,
          source: NotificationSource.TODO,
          entityType: 'todo_task',
          entityId: 'task-id-3',
          title: 'Task Due Soon',
          dueAt: dueDate,
        }),
      );

      const createArg = (repo.create as jest.Mock).mock.calls[0][0];
      expect(createArg.body).toContain('Deploy feature');
      expect(createArg.body).toContain('2026-03-05');
    });
  });

  describe('getUnreadCount', () => {
    it('should return count of unread notifications', async () => {
      const count = await service.getUnreadCount(
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
      );

      expect(count).toBe(3);
      expect(repo.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: '00000000-0000-0000-0000-000000000001',
            userId: '00000000-0000-0000-0000-000000000002',
          }),
        }),
      );
    });
  });

  describe('findTasksDueSoon', () => {
    it('should query for tasks with approaching due dates', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          dueDate: new Date(),
          assigneeUserId: 'user-1',
        },
      ];
      (repo.manager as { query: jest.Mock }).query.mockResolvedValue(mockTasks);

      const result = await service.findTasksDueSoon(
        '00000000-0000-0000-0000-000000000001',
        24,
      );

      expect(result).toEqual(mockTasks);
      expect((repo.manager as { query: jest.Mock }).query).toHaveBeenCalledWith(
        expect.stringContaining('todo_tasks'),
        expect.arrayContaining(['00000000-0000-0000-0000-000000000001']),
      );
    });
  });
});
