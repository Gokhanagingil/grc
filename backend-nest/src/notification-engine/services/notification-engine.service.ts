import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SysNotificationRule,
  NotificationChannel,
  RecipientConfig,
  RecipientType,
} from '../entities/sys-notification-rule.entity';
import { SysNotificationTemplate } from '../entities/sys-notification-template.entity';
import {
  SysNotificationDelivery,
  DeliveryStatus,
} from '../entities/sys-notification-delivery.entity';
import { SysUserNotification } from '../entities/sys-user-notification.entity';
import { SysEvent } from '../../event-bus/entities/sys-event.entity';
import { SafeTemplateService } from './safe-template.service';
import { ConditionEvaluatorService } from './condition-evaluator.service';
import { NotificationRateLimiterService } from './rate-limiter.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { StructuredLoggerService } from '../../common/logger';

@Injectable()
export class NotificationEngineService {
  private readonly logger: StructuredLoggerService;

  constructor(
    @InjectRepository(SysNotificationRule)
    private readonly ruleRepository: Repository<SysNotificationRule>,
    @InjectRepository(SysNotificationTemplate)
    private readonly templateRepository: Repository<SysNotificationTemplate>,
    @InjectRepository(SysNotificationDelivery)
    private readonly deliveryRepository: Repository<SysNotificationDelivery>,
    @InjectRepository(SysUserNotification)
    private readonly userNotificationRepository: Repository<SysUserNotification>,
    private readonly templateService: SafeTemplateService,
    private readonly conditionEvaluator: ConditionEvaluatorService,
    private readonly rateLimiter: NotificationRateLimiterService,
    private readonly webhookDelivery: WebhookDeliveryService,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('NotificationEngineService');
  }

  async processEvent(event: SysEvent): Promise<void> {
    const rules = await this.ruleRepository.find({
      where: {
        tenantId: event.tenantId,
        eventName: event.eventName,
        isActive: true,
      },
    });

    if (rules.length === 0) return;

    this.logger.log('Processing event for notification rules', {
      eventId: event.id,
      eventName: event.eventName,
      matchingRules: rules.length,
    });

    for (const rule of rules) {
      await this.processRule(rule, event);
    }
  }

  private async processRule(
    rule: SysNotificationRule,
    event: SysEvent,
  ): Promise<void> {
    try {
      const eventData = {
        ...event.payloadJson,
        event_name: event.eventName,
        table_name: event.tableName,
        record_id: event.recordId,
        source: event.source,
      };

      if (
        rule.condition &&
        Object.keys(rule.condition).length > 0 &&
        !this.conditionEvaluator.evaluate(rule.condition, eventData)
      ) {
        return;
      }

      if (!this.rateLimiter.isTenantAllowed(event.tenantId)) {
        await this.createDelivery(
          rule,
          event,
          'RATE_LIMITED',
          'Tenant rate limit exceeded',
        );
        return;
      }

      if (
        !this.rateLimiter.isAllowed(
          event.tenantId,
          rule.id,
          rule.rateLimitPerHour,
        )
      ) {
        await this.createDelivery(
          rule,
          event,
          'RATE_LIMITED',
          'Rule rate limit exceeded',
        );
        return;
      }

      let template: SysNotificationTemplate | null = null;
      if (rule.templateId) {
        template = await this.templateRepository.findOne({
          where: { id: rule.templateId, tenantId: event.tenantId },
        });
      }

      const title = template?.subject
        ? this.templateService.renderSubject(
            template.subject,
            eventData,
            template.allowedVariables,
          )
        : `${event.eventName} on ${event.tableName || 'system'}`;

      const body = template?.body
        ? this.templateService.render(
            template.body,
            eventData,
            template.allowedVariables,
          )
        : `Event: ${event.eventName}\nSource: ${event.source}\nRecord: ${event.recordId || 'N/A'}`;

      const recipients = this.resolveRecipients(rule.recipients, eventData);

      for (const channel of rule.channels) {
        for (const recipient of recipients) {
          await this.deliver(rule, event, channel, recipient, title, body);
        }
      }
    } catch (error) {
      this.logger.error('Failed to process notification rule', {
        ruleId: rule.id,
        eventId: event.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private resolveRecipients(
    recipientConfigs: RecipientConfig[],
    eventData: Record<string, unknown>,
  ): string[] {
    const recipients: string[] = [];

    for (const config of recipientConfigs) {
      switch (config.type) {
        case RecipientType.ROLE:
          recipients.push(`role:${config.value}`);
          break;
        case RecipientType.USER_FIELD: {
          const userId = eventData[config.value];
          if (userId && typeof userId === 'string') {
            recipients.push(`user:${userId}`);
          }
          break;
        }
        case RecipientType.STATIC_EMAIL:
          recipients.push(`email:${config.value}`);
          break;
      }
    }

    if (
      recipients.length === 0 &&
      eventData.userId &&
      typeof eventData.userId === 'string'
    ) {
      recipients.push(`user:${eventData.userId}`);
    }

    return recipients;
  }

  private async deliver(
    rule: SysNotificationRule,
    event: SysEvent,
    channel: NotificationChannel,
    recipient: string,
    title: string,
    body: string,
  ): Promise<void> {
    const delivery = await this.createDelivery(rule, event, 'PENDING');

    try {
      switch (channel) {
        case NotificationChannel.IN_APP:
          await this.deliverInApp(
            event.tenantId,
            recipient,
            title,
            body,
            event,
            delivery.id,
          );
          break;
        case NotificationChannel.EMAIL:
          this.logger.log('Email delivery (noop provider)', {
            ruleId: rule.id,
            recipient,
            deliveryId: delivery.id,
          });
          break;
        case NotificationChannel.WEBHOOK:
          await this.deliverWebhook(
            event.tenantId,
            recipient,
            event,
            delivery.id,
          );
          break;
      }

      await this.deliveryRepository.update(delivery.id, {
        status: DeliveryStatus.SENT,
        recipient,
        attempts: 1,
      });
    } catch (error) {
      await this.deliveryRepository.update(delivery.id, {
        status: DeliveryStatus.FAILED,
        recipient,
        attempts: 1,
        lastError: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async deliverInApp(
    tenantId: string,
    recipient: string,
    title: string,
    body: string,
    event: SysEvent,
    deliveryId: string,
  ): Promise<void> {
    const userIds = this.extractUserIds(recipient);

    for (const userId of userIds) {
      await this.userNotificationRepository.save(
        this.userNotificationRepository.create({
          tenantId,
          userId,
          title,
          body,
          link:
            event.tableName && event.recordId
              ? `/${event.tableName}/${event.recordId}`
              : null,
          deliveryId,
        }),
      );
    }
  }

  private async deliverWebhook(
    tenantId: string,
    recipient: string,
    event: SysEvent,
    deliveryId: string,
  ): Promise<void> {
    const payload = {
      eventName: event.eventName,
      tableName: event.tableName,
      recordId: event.recordId,
      tenantId,
      timestamp: new Date().toISOString(),
      data: event.payloadJson || {},
    };

    if (recipient.startsWith('webhook:')) {
      const endpointId = recipient.substring(8);
      await this.webhookDelivery.deliverWebhook(
        tenantId,
        endpointId,
        payload,
        deliveryId,
      );
    } else {
      await this.webhookDelivery.deliverToAllEndpoints(
        tenantId,
        payload,
        deliveryId,
      );
    }
  }

  private extractUserIds(recipient: string): string[] {
    if (recipient.startsWith('user:')) {
      return [recipient.substring(5)];
    }
    return [];
  }

  private async createDelivery(
    rule: SysNotificationRule,
    event: SysEvent,
    status: string,
    errorMsg?: string,
  ): Promise<SysNotificationDelivery> {
    return this.deliveryRepository.save(
      this.deliveryRepository.create({
        tenantId: event.tenantId,
        ruleId: rule.id,
        eventId: event.id,
        channel: rule.channels[0] || 'IN_APP',
        recipient: '',
        status: status as DeliveryStatus,
        lastError: errorMsg || null,
        payloadSnapshot: {
          eventName: event.eventName,
          tableName: event.tableName,
          recordId: event.recordId,
        },
      }),
    );
  }

  async findRulesByTenant(
    tenantId: string,
    filters?: {
      eventName?: string;
      isActive?: boolean;
      page?: number;
      pageSize?: number;
    },
  ): Promise<{ items: SysNotificationRule[]; total: number }> {
    const page = filters?.page || 1;
    const pageSize = Math.min(filters?.pageSize || 50, 100);

    const qb = this.ruleRepository
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId });

    if (filters?.eventName) {
      qb.andWhere('r.eventName = :eventName', { eventName: filters.eventName });
    }

    if (filters?.isActive !== undefined) {
      qb.andWhere('r.isActive = :isActive', { isActive: filters.isActive });
    }

    const total = await qb.getCount();
    qb.orderBy('r.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();
    return { items, total };
  }

  async findRuleByTenant(
    tenantId: string,
    ruleId: string,
  ): Promise<SysNotificationRule | null> {
    return this.ruleRepository.findOne({
      where: { id: ruleId, tenantId },
    });
  }

  async createRule(
    tenantId: string,
    data: Partial<SysNotificationRule>,
  ): Promise<SysNotificationRule> {
    const rule = this.ruleRepository.create({
      ...data,
      tenantId,
    });
    return this.ruleRepository.save(rule);
  }

  async updateRule(
    tenantId: string,
    ruleId: string,
    data: Partial<SysNotificationRule>,
  ): Promise<SysNotificationRule | null> {
    const rule = await this.ruleRepository.findOne({
      where: { id: ruleId, tenantId },
    });
    if (!rule) return null;

    Object.assign(rule, data);
    return this.ruleRepository.save(rule);
  }

  async deleteRule(tenantId: string, ruleId: string): Promise<boolean> {
    const result = await this.ruleRepository.delete({ id: ruleId, tenantId });
    return (result.affected || 0) > 0;
  }

  async findTemplatesByTenant(
    tenantId: string,
    filters?: { page?: number; pageSize?: number },
  ): Promise<{ items: SysNotificationTemplate[]; total: number }> {
    const page = filters?.page || 1;
    const pageSize = Math.min(filters?.pageSize || 50, 100);

    const [items, total] = await this.templateRepository.findAndCount({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { items, total };
  }

  async findTemplateByTenant(
    tenantId: string,
    templateId: string,
  ): Promise<SysNotificationTemplate | null> {
    return this.templateRepository.findOne({
      where: { id: templateId, tenantId },
    });
  }

  async createTemplate(
    tenantId: string,
    data: Partial<SysNotificationTemplate>,
  ): Promise<SysNotificationTemplate> {
    const template = this.templateRepository.create({
      ...data,
      tenantId,
    });
    return this.templateRepository.save(template);
  }

  async updateTemplate(
    tenantId: string,
    templateId: string,
    data: Partial<SysNotificationTemplate>,
  ): Promise<SysNotificationTemplate | null> {
    const template = await this.templateRepository.findOne({
      where: { id: templateId, tenantId },
    });
    if (!template) return null;

    Object.assign(template, data);
    return this.templateRepository.save(template);
  }

  async deleteTemplate(tenantId: string, templateId: string): Promise<boolean> {
    const result = await this.templateRepository.delete({
      id: templateId,
      tenantId,
    });
    return (result.affected || 0) > 0;
  }

  async findDeliveriesByTenant(
    tenantId: string,
    filters?: {
      ruleId?: string;
      status?: string;
      channel?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<{ items: SysNotificationDelivery[]; total: number }> {
    const page = filters?.page || 1;
    const pageSize = Math.min(filters?.pageSize || 50, 100);

    const qb = this.deliveryRepository
      .createQueryBuilder('d')
      .where('d.tenantId = :tenantId', { tenantId });

    if (filters?.ruleId) {
      qb.andWhere('d.ruleId = :ruleId', { ruleId: filters.ruleId });
    }

    if (filters?.status) {
      qb.andWhere('d.status = :status', { status: filters.status });
    }

    if (filters?.channel) {
      qb.andWhere('d.channel = :channel', { channel: filters.channel });
    }

    const total = await qb.getCount();
    qb.orderBy('d.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();
    return { items, total };
  }

  async getUserNotifications(
    tenantId: string,
    userId: string,
    filters?: {
      unreadOnly?: boolean;
      page?: number;
      pageSize?: number;
    },
  ): Promise<{
    items: SysUserNotification[];
    total: number;
    unreadCount: number;
  }> {
    const page = filters?.page || 1;
    const pageSize = Math.min(filters?.pageSize || 20, 100);

    const qb = this.userNotificationRepository
      .createQueryBuilder('n')
      .where('n.tenantId = :tenantId', { tenantId })
      .andWhere('n.userId = :userId', { userId });

    if (filters?.unreadOnly) {
      qb.andWhere('n.readAt IS NULL');
    }

    const total = await qb.getCount();

    const unreadCount = await this.userNotificationRepository
      .createQueryBuilder('n')
      .where('n.tenantId = :tenantId', { tenantId })
      .andWhere('n.userId = :userId', { userId })
      .andWhere('n.readAt IS NULL')
      .getCount();

    qb.orderBy('n.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();
    return { items, total, unreadCount };
  }

  async markNotificationRead(
    tenantId: string,
    userId: string,
    notificationId: string,
  ): Promise<boolean> {
    const result = await this.userNotificationRepository.update(
      { id: notificationId, tenantId, userId },
      { readAt: new Date() },
    );
    return (result.affected || 0) > 0;
  }

  async markAllNotificationsRead(
    tenantId: string,
    userId: string,
  ): Promise<number> {
    const result = await this.userNotificationRepository
      .createQueryBuilder()
      .update()
      .set({ readAt: new Date() })
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('userId = :userId', { userId })
      .andWhere('readAt IS NULL')
      .execute();
    return result.affected || 0;
  }

  async retryDelivery(
    tenantId: string,
    deliveryId: string,
  ): Promise<SysNotificationDelivery | null> {
    const delivery = await this.deliveryRepository.findOne({
      where: { id: deliveryId, tenantId },
    });

    if (!delivery || delivery.status !== DeliveryStatus.FAILED) return null;

    await this.deliveryRepository.update(delivery.id, {
      status: DeliveryStatus.PENDING,
      lastError: null,
    });

    return this.deliveryRepository.findOne({ where: { id: deliveryId } });
  }
}
