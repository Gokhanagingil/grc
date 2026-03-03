import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request as NestRequest,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/guards/tenant.guard';
import { RequestWithUser } from '../common/types';
import { NotificationEngineService } from './services/notification-engine.service';
import { NotificationTriggerService } from './services/notification-trigger.service';
import { NotificationActionService } from './services/notification-action.service';
import {
  UserNotificationFilterDto,
  ExecuteActionDto,
  SnoozeNotificationDto,
  CreatePersonalReminderDto,
} from './dto/user-notification.dto';
import { StructuredLoggerService } from '../common/logger';

/** Server-side allowlist of safe action types (v1.2) */
const ALLOWED_ACTION_TYPES = new Set([
  'OPEN_ENTITY',
  'OPEN_RECORD',
  'MARK_READ',
  'ASSIGN_TO_ME',
  'SET_DUE_DATE',
  'CREATE_FOLLOWUP_TODO',
]);

@Controller('grc/user-notifications')
@UseGuards(JwtAuthGuard, TenantGuard)
export class UserNotificationController {
  private readonly logger: StructuredLoggerService;

  constructor(
    private readonly engineService: NotificationEngineService,
    private readonly triggerService: NotificationTriggerService,
    private readonly actionService: NotificationActionService,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('UserNotificationController');
  }

  @Get()
  async listNotifications(
    @NestRequest() req: RequestWithUser,
    @Query() filter: UserNotificationFilterDto,
  ) {
    const tenantId = req.tenantId;
    const userId = req.user?.sub;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!userId) throw new BadRequestException('User ID required');

    const result = await this.engineService.getUserNotifications(
      tenantId,
      userId,
      {
        unreadOnly: filter.unreadOnly,
        module: filter.module,
        type: filter.type,
        severity: filter.severity,
        tab: filter.tab,
        page: filter.page,
        pageSize: filter.pageSize,
      },
    );

    return {
      items: result.items,
      total: result.total,
      unreadCount: result.unreadCount,
      snoozedCount: result.snoozedCount,
      page: filter.page || 1,
      pageSize: filter.pageSize || 20,
    };
  }

  @Get('unread-count')
  async getUnreadCount(@NestRequest() req: RequestWithUser) {
    const tenantId = req.tenantId;
    const userId = req.user?.sub;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!userId) throw new BadRequestException('User ID required');

    const count = await this.triggerService.getUnreadCount(tenantId, userId);
    return { unreadCount: count };
  }

  @Post(':id/read')
  async markRead(@NestRequest() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = req.tenantId;
    const userId = req.user?.sub;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!userId) throw new BadRequestException('User ID required');

    const success = await this.engineService.markNotificationRead(
      tenantId,
      userId,
      id,
    );
    if (!success) throw new NotFoundException('Notification not found');
    return { read: true };
  }

  @Post('read-all')
  async markAllRead(@NestRequest() req: RequestWithUser) {
    const tenantId = req.tenantId;
    const userId = req.user?.sub;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!userId) throw new BadRequestException('User ID required');

    const count = await this.engineService.markAllNotificationsRead(
      tenantId,
      userId,
    );
    return { markedRead: count };
  }

  @Post(':id/snooze')
  async snoozeNotification(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: SnoozeNotificationDto,
  ) {
    const tenantId = req.tenantId;
    const userId = req.user?.sub;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!userId) throw new BadRequestException('User ID required');

    const until = new Date(dto.until);
    if (isNaN(until.getTime()) || until.getTime() <= Date.now()) {
      throw new BadRequestException('Snooze time must be in the future');
    }

    this.logger.log('Notification snooze requested', {
      notificationId: id,
      userId,
      tenantId,
      snoozeUntil: dto.until,
    });

    const success = await this.engineService.snoozeNotification(
      tenantId,
      userId,
      id,
      until,
    );
    if (!success) throw new NotFoundException('Notification not found or already snoozed');
    return { snoozed: true, snoozeUntil: dto.until };
  }

  @Post(':id/unsnooze')
  async unsnoozeNotification(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId;
    const userId = req.user?.sub;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!userId) throw new BadRequestException('User ID required');

    this.logger.log('Notification unsnooze requested', {
      notificationId: id,
      userId,
      tenantId,
    });

    const success = await this.engineService.unsnoozeNotification(
      tenantId,
      userId,
      id,
    );
    if (!success) throw new NotFoundException('Notification not found or not snoozed');
    return { unsnoozed: true };
  }

  @Post('reminders')
  async createPersonalReminder(
    @NestRequest() req: RequestWithUser,
    @Body() dto: CreatePersonalReminderDto,
  ) {
    const tenantId = req.tenantId;
    const userId = req.user?.sub;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!userId) throw new BadRequestException('User ID required');

    const remindAt = new Date(dto.remindAt);
    if (isNaN(remindAt.getTime())) {
      throw new BadRequestException('Invalid remindAt date');
    }

    this.logger.log('Personal reminder creation requested', {
      userId,
      tenantId,
      title: dto.title,
      remindAt: dto.remindAt,
    });

    const notification = await this.engineService.createPersonalReminder(
      tenantId,
      userId,
      dto.title,
      dto.note,
      remindAt,
    );
    return notification;
  }

  /**
   * Get suggested next steps for a notification (v1.2).
   */
  @Get(':id/suggestions')
  async getSuggestions(
    @NestRequest() req: RequestWithUser,
    @Param('id') notificationId: string,
  ) {
    const tenantId = req.tenantId;
    const userId = req.user?.sub;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!userId) throw new BadRequestException('User ID required');

    const notification = await this.engineService.findNotificationById(
      tenantId,
      userId,
      notificationId,
    );
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const suggestions = this.actionService.getSuggestedActions(
      notification.type,
      notification,
    );

    return { suggestions };
  }

  /**
   * Execute a notification action (v1.2 — fully wired).
   * Server validates: tenantId, recipient match, RBAC, allowlist, audit log.
   */
  @Post(':id/actions/:actionId/execute')
  async executeAction(
    @NestRequest() req: RequestWithUser,
    @Param('id') notificationId: string,
    @Param('actionId') actionId: string,
    @Body() dto: ExecuteActionDto,
  ) {
    const tenantId = req.tenantId;
    const userId = req.user?.sub;
    const userRole = req.user?.role || '';
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    if (!userId) throw new BadRequestException('User ID required');

    // 1. Find the notification
    const notification = await this.engineService.findNotificationById(
      tenantId,
      userId,
      notificationId,
    );
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    // 2. Verify recipient is current user
    if (notification.userId !== userId) {
      throw new ForbiddenException('You can only execute actions on your own notifications');
    }

    // 3. Find the action in the notification's actions array
    const actions = notification.actions || [];
    const actionIndex = parseInt(actionId, 10);
    const action = !isNaN(actionIndex) ? actions[actionIndex] : undefined;
    if (!action) {
      throw new NotFoundException(`Action "${actionId}" not found on this notification`);
    }

    // 4. Server-side allowlist check
    if (!ALLOWED_ACTION_TYPES.has(action.actionType)) {
      throw new ForbiddenException(`Action type "${action.actionType}" is not allowed`);
    }

    // 5. Merge payload from action definition + client-supplied overrides
    const mergedPayload = { ...action.payload, ...(dto.payload || {}) };

    // 6. Audit log entry (pre-execution)
    this.logger.log('Notification action execution started', {
      notificationId,
      actionId,
      actionType: action.actionType,
      userId,
      tenantId,
      payload: mergedPayload,
      timestamp: new Date().toISOString(),
    });

    // 7. Execute based on action type
    let result: Record<string, unknown> = { executed: true, actionType: action.actionType };

    switch (action.actionType) {
      case 'MARK_READ':
        await this.engineService.markNotificationRead(tenantId, userId, notificationId);
        result = { ...result, read: true };
        break;

      case 'OPEN_ENTITY':
      case 'OPEN_RECORD':
        // Client-side navigation — server just acknowledges
        result = { ...result, navigate: true, payload: action.payload };
        break;

      case 'ASSIGN_TO_ME': {
        const assignResult = await this.actionService.executeAssignToMe(
          tenantId,
          userId,
          userRole,
          notification,
          mergedPayload,
        );
        result = { ...result, ...assignResult };
        break;
      }

      case 'SET_DUE_DATE': {
        const dueDateResult = await this.actionService.executeSetDueDate(
          tenantId,
          userId,
          notification,
          mergedPayload,
        );
        result = { ...result, ...dueDateResult };
        break;
      }

      case 'CREATE_FOLLOWUP_TODO': {
        const followupResult = await this.actionService.executeCreateFollowupTodo(
          tenantId,
          userId,
          notification,
          mergedPayload,
        );
        result = { ...result, ...followupResult };
        break;
      }

      default:
        result = { ...result, acknowledged: true };
        break;
    }

    return result;
  }
}
