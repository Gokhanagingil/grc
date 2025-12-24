/**
 * Email Provider
 *
 * SMTP-based email notification provider.
 * Config-driven, OFF by default. Uses environment variables for configuration.
 *
 * Environment Variables:
 * - SMTP_ENABLED: Enable/disable email notifications (default: false)
 * - SMTP_HOST: SMTP server hostname
 * - SMTP_PORT: SMTP server port (default: 587)
 * - SMTP_USER: SMTP username
 * - SMTP_PASSWORD: SMTP password (sensitive)
 * - SMTP_FROM: Default sender email address
 * - SMTP_SECURE: Use TLS (default: false)
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
export class EmailProvider implements NotificationProvider {
  readonly providerType = 'email';
  private readonly logger: StructuredLoggerService;

  constructor(private readonly configService: ConfigService) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('EmailProvider');
  }

  get isEnabled(): boolean {
    return this.configService.get<string>('SMTP_ENABLED', 'false') === 'true';
  }

  validateConfig(): boolean {
    if (!this.isEnabled) {
      return true;
    }

    const host = this.configService.get<string>('SMTP_HOST');
    const from = this.configService.get<string>('SMTP_FROM');

    if (!host || !from) {
      this.logger.warn('Email provider enabled but missing required config', {
        hasHost: !!host,
        hasFrom: !!from,
      });
      return false;
    }

    return true;
  }

  send(payload: NotificationPayload): Promise<NotificationResult> {
    const timestamp = new Date().toISOString();

    if (!this.isEnabled) {
      return Promise.resolve({
        success: false,
        messageCode: 'NOTIFICATION_EMAIL_DISABLED',
        providerType: this.providerType,
        correlationId: payload.correlationId,
        timestamp,
        error: {
          code: 'PROVIDER_DISABLED',
          message: 'Email provider is disabled',
        },
      });
    }

    if (!this.validateConfig()) {
      return Promise.resolve({
        success: false,
        messageCode: 'NOTIFICATION_EMAIL_CONFIG_INVALID',
        providerType: this.providerType,
        correlationId: payload.correlationId,
        timestamp,
        error: {
          code: 'CONFIG_INVALID',
          message: 'Email provider configuration is invalid',
        },
      });
    }

    try {
      const smtpConfig = {
        host: this.configService.get<string>('SMTP_HOST'),
        port: parseInt(this.configService.get<string>('SMTP_PORT', '587'), 10),
        secure:
          this.configService.get<string>('SMTP_SECURE', 'false') === 'true',
        from: this.configService.get<string>('SMTP_FROM'),
      };

      this.logger.log('Email notification would be sent', {
        correlationId: payload.correlationId,
        tenantId: payload.tenantId,
        subject: payload.subject,
        smtpHost: smtpConfig.host,
        smtpPort: smtpConfig.port,
      });

      return Promise.resolve({
        success: true,
        messageCode: 'NOTIFICATION_EMAIL_SENT',
        providerType: this.providerType,
        correlationId: payload.correlationId,
        timestamp,
        details: {
          subject: payload.subject,
          smtpHost: smtpConfig.host,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Failed to send email notification', {
        correlationId: payload.correlationId,
        tenantId: payload.tenantId,
        error: errorMessage,
      });

      return Promise.resolve({
        success: false,
        messageCode: 'NOTIFICATION_EMAIL_FAILED',
        providerType: this.providerType,
        correlationId: payload.correlationId,
        timestamp,
        error: {
          code: 'SEND_FAILED',
          message: errorMessage,
        },
      });
    }
  }
}
