import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SysNotificationRule } from './entities/sys-notification-rule.entity';
import { SysNotificationTemplate } from './entities/sys-notification-template.entity';
import { SysNotificationDelivery } from './entities/sys-notification-delivery.entity';
import { SysUserNotification } from './entities/sys-user-notification.entity';
import { SysWebhookEndpoint } from './entities/sys-webhook-endpoint.entity';
import { NotificationEngineService } from './services/notification-engine.service';
import { SafeTemplateService } from './services/safe-template.service';
import { ConditionEvaluatorService } from './services/condition-evaluator.service';
import { NotificationRateLimiterService } from './services/rate-limiter.service';
import { WebhookDeliveryService } from './services/webhook-delivery.service';
import { SsrfGuardService } from './services/ssrf-guard.service';
import { NotificationEngineListener } from './notification-engine.listener';
import { NotificationRuleController } from './notification-rule.controller';
import { NotificationTemplateController } from './notification-template.controller';
import { NotificationDeliveryController } from './notification-delivery.controller';
import { UserNotificationController } from './user-notification.controller';
import { WebhookEndpointController } from './webhook-endpoint.controller';
import { EventBusModule } from '../event-bus/event-bus.module';
import { GuardsModule } from '../common/guards';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SysNotificationRule,
      SysNotificationTemplate,
      SysNotificationDelivery,
      SysUserNotification,
      SysWebhookEndpoint,
    ]),
    EventBusModule,
    GuardsModule,
  ],
  controllers: [
    NotificationRuleController,
    NotificationTemplateController,
    NotificationDeliveryController,
    UserNotificationController,
    WebhookEndpointController,
  ],
  providers: [
    NotificationEngineService,
    SafeTemplateService,
    ConditionEvaluatorService,
    NotificationRateLimiterService,
    WebhookDeliveryService,
    SsrfGuardService,
    NotificationEngineListener,
  ],
  exports: [
    NotificationEngineService,
    SafeTemplateService,
    WebhookDeliveryService,
  ],
})
export class NotificationEngineModule {}
