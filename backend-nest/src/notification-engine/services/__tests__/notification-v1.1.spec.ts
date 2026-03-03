import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationEngineService } from '../notification-engine.service';
import {
  SysUserNotification,
} from '../../entities/sys-user-notification.entity';
import { SysNotificationRule } from '../../entities/sys-notification-rule.entity';
import { SysNotificationTemplate } from '../../entities/sys-notification-template.entity';
import { SysNotificationDelivery } from '../../entities/sys-notification-delivery.entity';
import { SafeTemplateService } from '../safe-template.service';
import { ConditionEvaluatorService } from '../condition-evaluator.service';
import { NotificationRateLimiterService } from '../rate-limiter.service';
import { WebhookDeliveryService } from '../webhook-delivery.service';

/**
 * Notification Center v1.1 unit tests
 * - Snooze / Unsnooze transitions
 * - Reminder activation logic
 * - Snapshot rendering fallback
 * - Mark-read idempotency with status filter
 */
describe('NotificationEngineService v1.1', () => {
  let service: NotificationEngineService;
  let mockQb: Record<string, jest.Mock>;

  const createMockQb = (affected = 1) => {
    const qb: Record<string, jest.Mock> = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected }),
    };
    return qb;
  };

  const mockUserNotificationRepo = {
    createQueryBuilder: jest.fn(),
    create: jest.fn().mockImplementation((data) => ({ id: 'reminder-uuid', ...data })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve({ ...entity, id: entity.id || 'reminder-uuid' })),
    findOne: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const mockRuleRepo = {
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }),
    findOne: jest.fn(),
  };

  const mockTemplateRepo = {
    findOne: jest.fn(),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
  };

  const mockDeliveryRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    }),
  };

  const mockSafeTemplateService = {
    render: jest.fn().mockReturnValue('rendered'),
  };

  const mockConditionEvaluator = {
    evaluate: jest.fn().mockReturnValue(true),
  };

  const mockRateLimiter = {
    isAllowed: jest.fn().mockResolvedValue(true),
    recordDelivery: jest.fn(),
  };

  const mockWebhookDelivery = {
    deliver: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    mockQb = createMockQb();
    mockUserNotificationRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationEngineService,
        { provide: getRepositoryToken(SysUserNotification), useValue: mockUserNotificationRepo },
        { provide: getRepositoryToken(SysNotificationRule), useValue: mockRuleRepo },
        { provide: getRepositoryToken(SysNotificationTemplate), useValue: mockTemplateRepo },
        { provide: getRepositoryToken(SysNotificationDelivery), useValue: mockDeliveryRepo },
        { provide: SafeTemplateService, useValue: mockSafeTemplateService },
        { provide: ConditionEvaluatorService, useValue: mockConditionEvaluator },
        { provide: NotificationRateLimiterService, useValue: mockRateLimiter },
        { provide: WebhookDeliveryService, useValue: mockWebhookDelivery },
      ],
    }).compile();

    service = module.get<NotificationEngineService>(NotificationEngineService);
  });

  /* ---- Snooze / Unsnooze ---- */

  describe('snoozeNotification', () => {
    it('should set status=SNOOZED and snoozeUntil when snoozing an ACTIVE notification', async () => {
      const until = new Date(Date.now() + 3600000);
      const result = await service.snoozeNotification('t1', 'u1', 'n1', until);

      expect(result).toBe(true);
      expect(mockQb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'SNOOZED',
          snoozeUntil: until,
        }),
      );
      // Verify it filters by ACTIVE status
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'status = :activeStatus',
        { activeStatus: 'ACTIVE' },
      );
    });

    it('should return false if notification is not found or already snoozed', async () => {
      const noAffectQb = createMockQb(0);
      mockUserNotificationRepo.createQueryBuilder = jest.fn().mockReturnValue(noAffectQb);

      const until = new Date(Date.now() + 3600000);
      const result = await service.snoozeNotification('t1', 'u1', 'nonexistent', until);

      expect(result).toBe(false);
    });
  });

  describe('unsnoozeNotification', () => {
    it('should set status=ACTIVE and clear snoozeUntil', async () => {
      const result = await service.unsnoozeNotification('t1', 'u1', 'n1');

      expect(result).toBe(true);
      expect(mockQb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ACTIVE',
        }),
      );
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'status = :snoozedStatus',
        { snoozedStatus: 'SNOOZED' },
      );
    });

    it('should return false if notification is not snoozed', async () => {
      const noAffectQb = createMockQb(0);
      mockUserNotificationRepo.createQueryBuilder = jest.fn().mockReturnValue(noAffectQb);

      const result = await service.unsnoozeNotification('t1', 'u1', 'n1');
      expect(result).toBe(false);
    });
  });

  /* ---- Reactivation ---- */

  describe('reactivateSnoozedNotifications', () => {
    it('should reactivate snoozed notifications past their snoozeUntil', async () => {
      const reactivateQb = createMockQb(3);
      mockUserNotificationRepo.createQueryBuilder = jest.fn().mockReturnValue(reactivateQb);

      const count = await service.reactivateSnoozedNotifications();

      expect(count).toBe(3);
      expect(reactivateQb.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACTIVE' }),
      );
      expect(reactivateQb.where).toHaveBeenCalledWith(
        'status = :status',
        { status: 'SNOOZED' },
      );
    });

    it('should return 0 when no snoozed notifications are due', async () => {
      const emptyQb = createMockQb(0);
      mockUserNotificationRepo.createQueryBuilder = jest.fn().mockReturnValue(emptyQb);

      const count = await service.reactivateSnoozedNotifications();
      expect(count).toBe(0);
    });
  });

  describe('activatePendingReminders', () => {
    it('should activate pending reminders past their remindAt', async () => {
      const activateQb = createMockQb(2);
      mockUserNotificationRepo.createQueryBuilder = jest.fn().mockReturnValue(activateQb);

      const count = await service.activatePendingReminders();

      expect(count).toBe(2);
      expect(activateQb.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACTIVE' }),
      );
      expect(activateQb.where).toHaveBeenCalledWith(
        'status = :status',
        { status: 'PENDING_REMINDER' },
      );
    });
  });

  /* ---- Personal Reminders ---- */

  describe('createPersonalReminder', () => {
    it('should create a PENDING_REMINDER for future remindAt', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      const result = await service.createPersonalReminder(
        't1', 'u1', 'Follow up', 'Check status', futureDate,
      );

      expect(result.id).toBe('reminder-uuid');
      expect(mockUserNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Follow up',
          body: 'Check status',
          type: 'PERSONAL_REMINDER',
          severity: 'INFO',
          source: 'SYSTEM',
          status: 'PENDING_REMINDER',
          remindAt: futureDate,
        }),
      );
    });

    it('should create an ACTIVE reminder for past remindAt', async () => {
      const pastDate = new Date(Date.now() - 60000);
      await service.createPersonalReminder(
        't1', 'u1', 'Past reminder', undefined, pastDate,
      );

      expect(mockUserNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ACTIVE',
          body: '',
        }),
      );
    });
  });

  /* ---- getUserNotifications with status filter ---- */

  describe('getUserNotifications', () => {
    it('should filter by ACTIVE status by default', async () => {
      await service.getUserNotifications('t1', 'u1');

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'n.status = :activeStatus',
        { activeStatus: 'ACTIVE' },
      );
    });

    it('should filter by SNOOZED status for snoozed tab', async () => {
      await service.getUserNotifications('t1', 'u1', { tab: 'snoozed' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'n.status = :snoozedStatus',
        { snoozedStatus: 'SNOOZED' },
      );
    });

    it('should return snoozedCount in response', async () => {
      const result = await service.getUserNotifications('t1', 'u1');
      expect(result).toHaveProperty('snoozedCount');
    });
  });

  /* ---- Mark all read respects status ---- */

  describe('markAllNotificationsRead', () => {
    it('should only mark ACTIVE notifications as read', async () => {
      await service.markAllNotificationsRead('t1', 'u1');

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'status = :activeStatus',
        { activeStatus: 'ACTIVE' },
      );
    });
  });
});
