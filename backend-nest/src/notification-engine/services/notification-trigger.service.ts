import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import {
  SysUserNotification,
  NotificationType,
  NotificationSeverity,
  NotificationSource,
  NotificationAction,
} from '../entities/sys-user-notification.entity';
import { StructuredLoggerService } from '../../common/logger';

export interface CreateNotificationPayload {
  tenantId: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  severity: NotificationSeverity;
  source: NotificationSource;
  entityType?: string;
  entityId?: string;
  link?: string;
  dueAt?: Date;
  metadata?: Record<string, unknown>;
  actions?: NotificationAction[];
}

/**
 * NotificationTriggerService
 *
 * Responsible for creating notifications programmatically from triggers
 * (task assignment, due-date reminders, etc.) without going through
 * the full rule-engine pipeline.
 *
 * This is the recommended way for other modules to create notifications.
 */
@Injectable()
export class NotificationTriggerService {
  private readonly logger: StructuredLoggerService;

  constructor(
    @InjectRepository(SysUserNotification)
    private readonly userNotificationRepo: Repository<SysUserNotification>,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('NotificationTriggerService');
  }

  /**
   * Create a single notification for a user.
   */
  async createNotification(
    payload: CreateNotificationPayload,
  ): Promise<SysUserNotification> {
    const notification = this.userNotificationRepo.create({
      tenantId: payload.tenantId,
      userId: payload.userId,
      title: payload.title,
      body: payload.body,
      type: payload.type,
      severity: payload.severity,
      source: payload.source,
      entityType: payload.entityType || null,
      entityId: payload.entityId || null,
      link:
        payload.link ||
        (payload.entityType && payload.entityId
          ? `/${payload.entityType}/${payload.entityId}`
          : null),
      dueAt: payload.dueAt || null,
      metadata: payload.metadata || {},
      actions: payload.actions || [],
    });

    const saved = await this.userNotificationRepo.save(notification);

    this.logger.log('Notification created', {
      notificationId: saved.id,
      type: saved.type,
      source: saved.source,
      userId: saved.userId,
    });

    return saved;
  }

  /**
   * Create a task-assignment notification.
   */
  async notifyTaskAssignment(
    tenantId: string,
    assigneeUserId: string,
    taskId: string,
    taskTitle: string,
    assignedByName?: string,
  ): Promise<SysUserNotification> {
    const byText = assignedByName ? ` by ${assignedByName}` : '';
    return this.createNotification({
      tenantId,
      userId: assigneeUserId,
      title: 'Task Assigned',
      body: `You have been assigned to "${taskTitle}"${byText}.`,
      type: NotificationType.ASSIGNMENT,
      severity: NotificationSeverity.INFO,
      source: NotificationSource.TODO,
      entityType: 'todo_task',
      entityId: taskId,
      actions: [
        {
          label: 'Open Task',
          actionType: 'OPEN_RECORD',
          payload: { entityType: 'todo_task', entityId: taskId },
        },
      ],
    });
  }

  /**
   * Create a due-date approaching notification.
   */
  async notifyDueDateApproaching(
    tenantId: string,
    assigneeUserId: string,
    taskId: string,
    taskTitle: string,
    dueDate: Date,
  ): Promise<SysUserNotification> {
    return this.createNotification({
      tenantId,
      userId: assigneeUserId,
      title: 'Task Due Soon',
      body: `"${taskTitle}" is due on ${dueDate.toISOString().split('T')[0]}.`,
      type: NotificationType.DUE_DATE,
      severity: NotificationSeverity.WARNING,
      source: NotificationSource.TODO,
      entityType: 'todo_task',
      entityId: taskId,
      dueAt: dueDate,
      actions: [
        {
          label: 'Open Task',
          actionType: 'OPEN_RECORD',
          payload: { entityType: 'todo_task', entityId: taskId },
        },
      ],
    });
  }

  /**
   * Find tasks approaching due date (within next N hours) that haven't
   * already been notified. Used by the cron job.
   *
   * Returns tasks from the todo_tasks table that:
   * - Have a due date within the window
   * - Are not completed/done
   * - Have an assignee
   * - Haven't already received a DUE_DATE notification for this entity
   */
  async findTasksDueSoon(
    tenantId: string,
    withinHours: number = 24,
  ): Promise<
    Array<{
      id: string;
      title: string;
      dueDate: Date;
      assigneeUserId: string;
    }>
  > {
    const now = new Date();
    const cutoff = new Date(now.getTime() + withinHours * 60 * 60 * 1000);

    // Raw query to find tasks with approaching due dates that don't have
    // an existing DUE_DATE notification
    const tasks = await this.userNotificationRepo.manager.query(
      `
      SELECT t.id, t.title, t.due_date as "dueDate", t.assignee_user_id as "assigneeUserId"
      FROM todo_tasks t
      WHERE t.tenant_id = $1
        AND t.due_date IS NOT NULL
        AND t.due_date > $2
        AND t.due_date <= $3
        AND t.assignee_user_id IS NOT NULL
        AND t.is_deleted = false
        AND t.status NOT IN ('done', 'completed')
        AND NOT EXISTS (
          SELECT 1 FROM sys_user_notifications n
          WHERE n.entity_type = 'todo_task'
            AND n.entity_id = t.id
            AND n.type = 'DUE_DATE'
            AND n.tenant_id = t.tenant_id
            AND n.created_at > $2 - INTERVAL '24 hours'
        )
      ORDER BY t.due_date ASC
      LIMIT 500
      `,
      [tenantId, now, cutoff],
    );

    return tasks;
  }

  /**
   * Get count of unread notifications for a user.
   */
  async getUnreadCount(tenantId: string, userId: string): Promise<number> {
    return this.userNotificationRepo.count({
      where: {
        tenantId,
        userId,
        readAt: IsNull(),
      },
    });
  }
}
