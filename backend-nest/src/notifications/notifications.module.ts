/**
 * Notifications Module
 *
 * Provides notification infrastructure for the GRC Platform:
 * - Email notifications (SMTP, config-driven, OFF by default)
 * - Webhook notifications (generic HTTP POST)
 * - Audit logging for all notification attempts
 * - Admin endpoints for status and testing
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { EmailProvider } from './providers/email.provider';
import { WebhookProvider } from './providers/webhook.provider';
import { NotificationLog } from './entities/notification-log.entity';
import { GuardsModule } from '../common/guards';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([NotificationLog]),
    GuardsModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailProvider, WebhookProvider],
  exports: [NotificationsService],
})
export class NotificationsModule {}
