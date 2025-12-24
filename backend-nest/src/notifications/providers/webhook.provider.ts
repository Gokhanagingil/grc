/**
 * Webhook Provider
 *
 * Generic HTTP POST webhook notification provider.
 * Sends notifications to configured webhook URLs.
 *
 * Environment Variables:
 * - WEBHOOK_ENABLED: Enable/disable webhook notifications (default: false)
 * - WEBHOOK_URL: Default webhook URL for notifications
 * - WEBHOOK_SECRET: Optional secret for webhook signature (sensitive)
 * - WEBHOOK_TIMEOUT_MS: Request timeout in milliseconds (default: 5000)
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationProvider,
  NotificationPayload,
  NotificationResult,
} from '../interfaces/notification-provider.interface';
import { StructuredLoggerService } from '../../common/logger';

@Injectable()
export class WebhookProvider implements NotificationProvider {
  readonly providerType = 'webhook';
  private readonly logger: StructuredLoggerService;

  constructor(private readonly configService: ConfigService) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('WebhookProvider');
  }

  get isEnabled(): boolean {
    return (
      this.configService.get<string>('WEBHOOK_ENABLED', 'false') === 'true'
    );
  }

  validateConfig(): boolean {
    if (!this.isEnabled) {
      return true;
    }

    const url = this.configService.get<string>('WEBHOOK_URL');

    if (!url) {
      this.logger.warn('Webhook provider enabled but missing URL config');
      return false;
    }

    try {
      new URL(url);
      return true;
    } catch {
      this.logger.warn('Webhook URL is invalid', { url });
      return false;
    }
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    const timestamp = new Date().toISOString();

    if (!this.isEnabled) {
      return {
        success: false,
        messageCode: 'NOTIFICATION_WEBHOOK_DISABLED',
        providerType: this.providerType,
        correlationId: payload.correlationId,
        timestamp,
        error: {
          code: 'PROVIDER_DISABLED',
          message: 'Webhook provider is disabled',
        },
      };
    }

    if (!this.validateConfig()) {
      return {
        success: false,
        messageCode: 'NOTIFICATION_WEBHOOK_CONFIG_INVALID',
        providerType: this.providerType,
        correlationId: payload.correlationId,
        timestamp,
        error: {
          code: 'CONFIG_INVALID',
          message: 'Webhook provider configuration is invalid',
        },
      };
    }

    const webhookUrl = this.configService.get<string>('WEBHOOK_URL');
    const timeoutMs = parseInt(
      this.configService.get<string>('WEBHOOK_TIMEOUT_MS', '5000'),
      10,
    );

    try {
      const webhookPayload = {
        event: 'notification',
        correlationId: payload.correlationId,
        tenantId: payload.tenantId,
        userId: payload.userId,
        subject: payload.subject,
        body: payload.body,
        metadata: payload.metadata,
        timestamp,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(webhookUrl!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': payload.correlationId,
            'X-Tenant-ID': payload.tenantId,
          },
          body: JSON.stringify(webhookPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        this.logger.log('Webhook notification sent successfully', {
          correlationId: payload.correlationId,
          tenantId: payload.tenantId,
          webhookUrl,
          statusCode: response.status,
        });

        return {
          success: true,
          messageCode: 'NOTIFICATION_WEBHOOK_SENT',
          providerType: this.providerType,
          correlationId: payload.correlationId,
          timestamp,
          details: {
            webhookUrl,
            statusCode: response.status,
          },
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const isTimeout = error instanceof Error && error.name === 'AbortError';

      this.logger.error('Failed to send webhook notification', {
        correlationId: payload.correlationId,
        tenantId: payload.tenantId,
        webhookUrl,
        error: errorMessage,
        isTimeout,
      });

      return {
        success: false,
        messageCode: isTimeout
          ? 'NOTIFICATION_WEBHOOK_TIMEOUT'
          : 'NOTIFICATION_WEBHOOK_FAILED',
        providerType: this.providerType,
        correlationId: payload.correlationId,
        timestamp,
        error: {
          code: isTimeout ? 'TIMEOUT' : 'SEND_FAILED',
          message: errorMessage,
        },
      };
    }
  }
}
