import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SysNotificationRule } from './entities/sys-notification-rule.entity';
import { SysNotificationTemplate } from './entities/sys-notification-template.entity';
import { SysNotificationDelivery } from './entities/sys-notification-delivery.entity';
import { SysUserNotification } from './entities/sys-user-notification.entity';
import { SysNotificationPreference } from './entities/sys-notification-preference.entity';
import { SysWebhookEndpoint } from './entities/sys-webhook-endpoint.entity';
import { TodoTask } from '../todos/entities/todo-task.entity';
import { TodoBoard } from '../todos/entities/todo-board.entity';
import { TodoTag } from '../todos/entities/todo-tag.entity';
import { TodoTaskTag } from '../todos/entities/todo-task-tag.entity';
import { SysGroup } from '../groups/entities/group.entity';
import { SysGroupMembership } from '../groups/entities/group-membership.entity';
import { NotificationEngineService } from './services/notification-engine.service';
import { NotificationTriggerService } from './services/notification-trigger.service';
import { NotificationActionService } from './services/notification-action.service';
import { DueDateScannerService } from './services/due-date-scanner.service';
import { SnoozeReminderScannerService } from './services/snooze-reminder-scanner.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
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
import { NotificationPreferenceController } from './notification-preference.controller';
import { WebhookEndpointController } from './webhook-endpoint.controller';
import { EventBusModule } from '../event-bus/event-bus.module';
import { GuardsModule } from '../common/guards';
import { AiAdminModule } from '../ai-admin/ai-admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SysNotificationRule,
      SysNotificationTemplate,
      SysNotificationDelivery,
      SysUserNotification,
      SysNotificationPreference,
      SysWebhookEndpoint,
      // v1.2: entities needed for action execution
      TodoTask,
      TodoBoard,
      TodoTag,
      TodoTaskTag,
      SysGroup,
      SysGroupMembership,
    ]),
    EventBusModule,
    GuardsModule,
    AiAdminModule,
  ],
  controllers: [
    NotificationRuleController,
    NotificationTemplateController,
    NotificationDeliveryController,
    UserNotificationController,
    NotificationPreferenceController,
    WebhookEndpointController,
  ],
  providers: [
    NotificationEngineService,
    NotificationTriggerService,
    NotificationActionService,
    DueDateScannerService,
    SnoozeReminderScannerService,
    SafeTemplateService,
    ConditionEvaluatorService,
    NotificationRateLimiterService,
    WebhookDeliveryService,
    SsrfGuardService,
    NotificationEngineListener,
    NotificationPreferenceService,
  ],
  exports: [
    NotificationEngineService,
    NotificationTriggerService,
    NotificationActionService,
    SafeTemplateService,
    WebhookDeliveryService,
    SsrfGuardService,
    NotificationPreferenceService,
  ],
})
export class NotificationEngineModule {}
