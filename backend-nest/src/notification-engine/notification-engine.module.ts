import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SysNotificationRule } from './entities/sys-notification-rule.entity';
import { SysNotificationTemplate } from './entities/sys-notification-template.entity';
import { SysNotificationDelivery } from './entities/sys-notification-delivery.entity';
import { SysUserNotification } from './entities/sys-user-notification.entity';
import { NotificationEngineService } from './services/notification-engine.service';
import { SafeTemplateService } from './services/safe-template.service';
import { ConditionEvaluatorService } from './services/condition-evaluator.service';
import { NotificationRateLimiterService } from './services/rate-limiter.service';
import { NotificationEngineListener } from './notification-engine.listener';
import { NotificationRuleController } from './notification-rule.controller';
import { NotificationTemplateController } from './notification-template.controller';
import { NotificationDeliveryController } from './notification-delivery.controller';
import { UserNotificationController } from './user-notification.controller';
import { EventBusModule } from '../event-bus/event-bus.module';
import { GuardsModule } from '../common/guards';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SysNotificationRule,
      SysNotificationTemplate,
      SysNotificationDelivery,
      SysUserNotification,
    ]),
    EventBusModule,
    GuardsModule,
  ],
  controllers: [
    NotificationRuleController,
    NotificationTemplateController,
    NotificationDeliveryController,
    UserNotificationController,
  ],
  providers: [
    NotificationEngineService,
    SafeTemplateService,
    ConditionEvaluatorService,
    NotificationRateLimiterService,
    NotificationEngineListener,
  ],
  exports: [NotificationEngineService, SafeTemplateService],
})
export class NotificationEngineModule {}
