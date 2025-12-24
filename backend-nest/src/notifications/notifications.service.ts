/**
 * Notification Service
 *
 * Central service for sending notifications through various providers.
 * Handles provider selection, audit logging, and result aggregation.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  NotificationPayload,
  NotificationResult,
} from './interfaces/notification-provider.interface';
import { EmailProvider } from './providers/email.provider';
import { WebhookProvider } from './providers/webhook.provider';
import {
  NotificationLog,
  NotificationStatus,
  NotificationProviderType,
} from './entities/notification-log.entity';
import { StructuredLoggerService } from '../common/logger';

export interface SendNotificationOptions {
  tenantId: string;
  userId?: string;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
  providers?: ('email' | 'webhook')[];
  correlationId?: string;
}

export interface NotificationSummary {
  correlationId: string;
  timestamp: string;
  results: NotificationResult[];
  overallSuccess: boolean;
  successCount: number;
  failureCount: number;
}

export interface NotificationStatusSummary {
  email: {
    enabled: boolean;
    configValid: boolean;
  };
  webhook: {
    enabled: boolean;
    configValid: boolean;
  };
  recentLogs: {
    total: number;
    success: number;
    failed: number;
    lastAttempt: Date | null;
  };
}

@Injectable()
export class NotificationsService {
  private readonly logger: StructuredLoggerService;

  constructor(
    private readonly emailProvider: EmailProvider,
    private readonly webhookProvider: WebhookProvider,
    @InjectRepository(NotificationLog)
    private readonly notificationLogRepository: Repository<NotificationLog>,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('NotificationsService');
  }

  async send(options: SendNotificationOptions): Promise<NotificationSummary> {
    const correlationId = options.correlationId || randomUUID();
    const timestamp = new Date().toISOString();
    const results: NotificationResult[] = [];

    const providers = options.providers || ['email', 'webhook'];

    const payload: NotificationPayload = {
      correlationId,
      tenantId: options.tenantId,
      userId: options.userId,
      subject: options.subject,
      body: options.body,
      metadata: options.metadata,
    };

    this.logger.log('Sending notification', {
      correlationId,
      tenantId: options.tenantId,
      providers,
      hasSubject: !!options.subject,
    });

    for (const providerName of providers) {
      let result: NotificationResult;

      if (providerName === 'email') {
        result = await this.emailProvider.send(payload);
      } else if (providerName === 'webhook') {
        result = await this.webhookProvider.send(payload);
      } else {
        const unknownProvider = providerName as string;
        result = {
          success: false,
          messageCode: 'NOTIFICATION_PROVIDER_UNKNOWN',
          providerType: unknownProvider,
          correlationId,
          timestamp,
          error: {
            code: 'UNKNOWN_PROVIDER',
            message: `Unknown provider: ${unknownProvider}`,
          },
        };
      }

      results.push(result);

      await this.logNotificationAttempt(options, result);
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return {
      correlationId,
      timestamp,
      results,
      overallSuccess: successCount > 0,
      successCount,
      failureCount,
    };
  }

  async sendTestNotification(
    tenantId: string,
    userId: string,
    provider: 'email' | 'webhook',
  ): Promise<NotificationResult> {
    const correlationId = randomUUID();

    const payload: NotificationPayload = {
      correlationId,
      tenantId,
      userId,
      subject: 'GRC Platform Test Notification',
      body: `This is a test notification from the GRC Platform. Timestamp: ${new Date().toISOString()}`,
      metadata: {
        isTest: true,
        triggeredBy: userId,
      },
    };

    this.logger.log('Sending test notification', {
      correlationId,
      tenantId,
      userId,
      provider,
    });

    let result: NotificationResult;

    if (provider === 'email') {
      result = await this.emailProvider.send(payload);
    } else {
      result = await this.webhookProvider.send(payload);
    }

    await this.logNotificationAttempt(
      {
        tenantId,
        userId,
        subject: payload.subject,
        body: payload.body,
        metadata: payload.metadata,
        correlationId,
      },
      result,
    );

    return result;
  }

  async getNotificationStatus(
    tenantId: string,
  ): Promise<NotificationStatusSummary> {
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);

    const recentLogs = await this.notificationLogRepository
      .createQueryBuilder('log')
      .where('log.tenantId = :tenantId', { tenantId })
      .andWhere('log.createdAt >= :since', { since: last24Hours })
      .getMany();

    const successCount = recentLogs.filter(
      (l) => l.status === NotificationStatus.SUCCESS,
    ).length;
    const failedCount = recentLogs.filter(
      (l) => l.status === NotificationStatus.FAILED,
    ).length;

    const lastLog = await this.notificationLogRepository.findOne({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });

    return {
      email: {
        enabled: this.emailProvider.isEnabled,
        configValid: this.emailProvider.validateConfig(),
      },
      webhook: {
        enabled: this.webhookProvider.isEnabled,
        configValid: this.webhookProvider.validateConfig(),
      },
      recentLogs: {
        total: recentLogs.length,
        success: successCount,
        failed: failedCount,
        lastAttempt: lastLog?.createdAt || null,
      },
    };
  }

  async getRecentLogs(
    tenantId: string,
    limit: number = 10,
  ): Promise<NotificationLog[]> {
    return this.notificationLogRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  private async logNotificationAttempt(
    options: SendNotificationOptions,
    result: NotificationResult,
  ): Promise<void> {
    try {
      const log = this.notificationLogRepository.create({
        tenantId: options.tenantId,
        userId: options.userId || null,
        correlationId: result.correlationId,
        providerType: result.providerType as NotificationProviderType,
        status: result.success
          ? NotificationStatus.SUCCESS
          : result.error?.code === 'PROVIDER_DISABLED'
            ? NotificationStatus.DISABLED
            : NotificationStatus.FAILED,
        messageCode: result.messageCode,
        subject: options.subject || null,
        body: options.body.substring(0, 1000),
        errorCode: result.error?.code || null,
        errorMessage: result.error?.message || null,
        metadata: options.metadata || null,
        details: result.details || null,
      });

      await this.notificationLogRepository.save(log);

      this.logger.debug('Notification attempt logged', {
        correlationId: result.correlationId,
        providerType: result.providerType,
        status: log.status,
      });
    } catch (error) {
      this.logger.error('Failed to log notification attempt', {
        correlationId: result.correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
