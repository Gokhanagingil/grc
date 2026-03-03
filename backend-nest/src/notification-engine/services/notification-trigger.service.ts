import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as crypto from 'crypto';
import {
  SysUserNotification,
  NotificationType,
  NotificationSeverity,
  NotificationSource,
  NotificationAction,
  EntitySnapshot,
  ActionDangerLevel,
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
  snapshot?: EntitySnapshot;
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
      metadata: {
        ...payload.metadata,
        ...(payload.snapshot ? { snapshot: payload.snapshot } : {}),
      },
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
    taskMeta?: { dueDate?: string; priority?: string; boardName?: string; tags?: string[] },
  ): Promise<SysUserNotification> {
    const byText = assignedByName ? ` by ${assignedByName}` : '';

    // Build entity snapshot for rich preview
    const keyFields: Array<{ label: string; value: string }> = [];
    if (taskMeta?.dueDate) keyFields.push({ label: 'Due', value: taskMeta.dueDate });
    if (taskMeta?.priority) keyFields.push({ label: 'Priority', value: taskMeta.priority });
    if (taskMeta?.boardName) keyFields.push({ label: 'Board', value: taskMeta.boardName });
    if (taskMeta?.tags?.length) keyFields.push({ label: 'Tags', value: taskMeta.tags.join(', ') });

    const snapshot: EntitySnapshot = {
      primaryLabel: taskTitle,
      secondaryLabel: assignedByName ? `Assigned by ${assignedByName}` : undefined,
      keyFields,
    };

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
      metadata: { reason: 'Assigned to you' },
      snapshot,
      actions: [
        {
          id: 'open_task',
          label: 'Open Task',
          actionType: 'OPEN_RECORD',
          payload: { entityType: 'todo_task', entityId: taskId },
          dangerLevel: ActionDangerLevel.SAFE,
        },
        {
          id: 'assign_to_me',
          label: 'Assign to Me',
          actionType: 'ASSIGN_TO_ME',
          requiresConfirm: true,
          payload: { entityType: 'todo_task', entityId: taskId },
          dangerLevel: ActionDangerLevel.SAFE,
        },
        {
          id: 'set_due_date',
          label: 'Set Due Date',
          actionType: 'SET_DUE_DATE',
          requiresConfirm: true,
          payload: { entityType: 'todo_task', entityId: taskId },
          dangerLevel: ActionDangerLevel.SAFE,
        },
        {
          id: 'create_followup',
          label: 'Create Follow-up',
          actionType: 'CREATE_FOLLOWUP_TODO',
          requiresConfirm: true,
          payload: { entityType: 'todo_task', entityId: taskId },
          dangerLevel: ActionDangerLevel.SAFE,
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
    taskMeta?: { priority?: string; boardName?: string },
  ): Promise<SysUserNotification> {
    const keyFields: Array<{ label: string; value: string }> = [
      { label: 'Due', value: dueDate.toISOString().split('T')[0] },
    ];
    if (taskMeta?.priority) keyFields.push({ label: 'Priority', value: taskMeta.priority });
    if (taskMeta?.boardName) keyFields.push({ label: 'Board', value: taskMeta.boardName });

    const snapshot: EntitySnapshot = {
      primaryLabel: taskTitle,
      secondaryLabel: `Due ${dueDate.toISOString().split('T')[0]}`,
      keyFields,
    };

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
      metadata: { reason: 'Due date approaching' },
      snapshot,
      actions: [
        {
          id: 'open_task',
          label: 'Open Task',
          actionType: 'OPEN_RECORD',
          payload: { entityType: 'todo_task', entityId: taskId },
          dangerLevel: ActionDangerLevel.SAFE,
        },
        {
          id: 'set_due_date',
          label: 'Set Due Date',
          actionType: 'SET_DUE_DATE',
          requiresConfirm: true,
          payload: { entityType: 'todo_task', entityId: taskId },
          dangerLevel: ActionDangerLevel.SAFE,
        },
        {
          id: 'create_followup',
          label: 'Create Follow-up',
          actionType: 'CREATE_FOLLOWUP_TODO',
          requiresConfirm: true,
          payload: { entityType: 'todo_task', entityId: taskId },
          dangerLevel: ActionDangerLevel.SAFE,
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
    // Only count ACTIVE (not snoozed/pending) unread notifications
    return this.userNotificationRepo
      .createQueryBuilder('n')
      .where('n.tenantId = :tenantId', { tenantId })
      .andWhere('n.userId = :userId', { userId })
      .andWhere('n.readAt IS NULL')
      .andWhere('n.status = :status', { status: 'ACTIVE' })
      .getCount();
  }

  /* ------------------------------------------------------------------ */
  /* Dedup / Anti-spam                                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Generate a deterministic dedup key for a notification.
   * Uses a time bucket (default 6h) to prevent re-notifying within the window.
   */
  private generateDedupKey(
    tenantId: string,
    userId: string,
    type: string,
    entityId: string,
    bucketHours: number = 6,
  ): string {
    const bucket = Math.floor(Date.now() / (bucketHours * 3600 * 1000));
    const raw = `${tenantId}:${userId}:${type}:${entityId}:${bucket}`;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
  }

  /**
   * Check if a notification with this dedup key already exists.
   * Uses metadata.dedupKey stored in the notification.
   */
  async isDuplicate(
    tenantId: string,
    userId: string,
    type: string,
    entityId: string,
    bucketHours: number = 6,
  ): Promise<boolean> {
    const dedupKey = this.generateDedupKey(tenantId, userId, type, entityId, bucketHours);
    const existing = await this.userNotificationRepo
      .createQueryBuilder('n')
      .where('n.tenantId = :tenantId', { tenantId })
      .andWhere('n.userId = :userId', { userId })
      .andWhere('n.type = :type', { type })
      .andWhere("n.metadata->>'dedupKey' = :dedupKey", { dedupKey })
      .getCount();
    return existing > 0;
  }

  /**
   * Create a notification with dedup protection.
   * Returns null if duplicate within the time bucket.
   */
  async createNotificationWithDedup(
    payload: CreateNotificationPayload,
    bucketHours: number = 6,
  ): Promise<SysUserNotification | null> {
    if (!payload.entityId) {
      return this.createNotification(payload);
    }

    // Compute dedup key once to avoid bucket-boundary race between check and store
    const dedupKey = this.generateDedupKey(
      payload.tenantId,
      payload.userId,
      payload.type,
      payload.entityId,
      bucketHours,
    );

    // Check for existing notification with this dedup key
    const existing = await this.userNotificationRepo
      .createQueryBuilder('n')
      .where('n.tenantId = :tenantId', { tenantId: payload.tenantId })
      .andWhere('n.userId = :userId', { userId: payload.userId })
      .andWhere('n.type = :type', { type: payload.type })
      .andWhere("n.metadata->>'dedupKey' = :dedupKey", { dedupKey })
      .getCount();

    if (existing > 0) {
      this.logger.log('Notification deduped', {
        type: payload.type,
        entityId: payload.entityId,
        userId: payload.userId,
      });
      return null;
    }

    const enrichedPayload = {
      ...payload,
      metadata: { ...payload.metadata, dedupKey },
    };
    return this.createNotification(enrichedPayload);
  }

  /* ------------------------------------------------------------------ */
  /* Group-based fan-out                                                  */
  /* ------------------------------------------------------------------ */

  /**
   * Notify all members of a group about a task assignment.
   * Uses dedup to prevent spamming the same user within the time bucket.
   */
  async notifyGroupTaskAssignment(
    tenantId: string,
    groupUserIds: string[],
    taskId: string,
    taskTitle: string,
    assignedByName?: string,
  ): Promise<SysUserNotification[]> {
    const results: SysUserNotification[] = [];
    const byText = assignedByName ? ` by ${assignedByName}` : '';

    for (const userId of groupUserIds) {
      const notification = await this.createNotificationWithDedup(
        {
          tenantId,
          userId,
          title: 'Group Task Assigned',
          body: `A task "${taskTitle}" was assigned to your group${byText}.`,
          type: NotificationType.ASSIGNMENT,
          severity: NotificationSeverity.INFO,
          source: NotificationSource.TODO,
          entityType: 'todo_task',
          entityId: taskId,
          actions: [
            {
              id: 'open_task',
              label: 'Open Task',
              actionType: 'OPEN_RECORD',
              payload: { entityType: 'todo_task', entityId: taskId },
              dangerLevel: ActionDangerLevel.SAFE,
            },
            {
              id: 'assign_to_me',
              label: 'Assign to Me',
              actionType: 'ASSIGN_TO_ME',
              requiresConfirm: true,
              payload: { entityType: 'todo_task', entityId: taskId },
              dangerLevel: ActionDangerLevel.SAFE,
            },
            {
              id: 'set_due_date',
              label: 'Set Due Date',
              actionType: 'SET_DUE_DATE',
              requiresConfirm: true,
              payload: { entityType: 'todo_task', entityId: taskId },
              dangerLevel: ActionDangerLevel.SAFE,
            },
            {
              id: 'create_followup',
              label: 'Create Follow-up',
              actionType: 'CREATE_FOLLOWUP_TODO',
              requiresConfirm: true,
              payload: { entityType: 'todo_task', entityId: taskId },
              dangerLevel: ActionDangerLevel.SAFE,
            },
          ],
        },
        6, // 6-hour dedup bucket
      );
      if (notification) results.push(notification);
    }

    this.logger.log('Group notification fan-out', {
      groupSize: groupUserIds.length,
      sent: results.length,
      taskId,
    });

    return results;
  }

  /* ------------------------------------------------------------------ */
  /* Major incident trigger (feature-flagged)                             */
  /* ------------------------------------------------------------------ */

  /**
   * Create a CRITICAL notification for a major incident.
   * Feature-flagged: only fires if ENABLE_MAJOR_INCIDENT_NOTIFICATIONS=true.
   */
  async notifyMajorIncident(
    tenantId: string,
    assigneeUserId: string,
    incidentId: string,
    incidentTitle: string,
    priority?: string,
  ): Promise<SysUserNotification | null> {
    const enabled = process.env.ENABLE_MAJOR_INCIDENT_NOTIFICATIONS === 'true';
    if (!enabled) {
      this.logger.log('Major incident notification skipped (feature flag off)');
      return null;
    }

    return this.createNotificationWithDedup(
      {
        tenantId,
        userId: assigneeUserId,
        title: 'Major Incident',
        body: `Major incident "${incidentTitle}"${priority ? ` (${priority})` : ''} requires your attention.`,
        type: NotificationType.STATUS_CHANGE,
        severity: NotificationSeverity.CRITICAL,
        source: NotificationSource.ITSM,
        entityType: 'itsm_incident',
        entityId: incidentId,
        actions: [
          {
            label: 'Open Incident',
            actionType: 'OPEN_RECORD',
            payload: { entityType: 'itsm_incident', entityId: incidentId },
          },
        ],
      },
      1, // 1-hour dedup bucket for major incidents
    );
  }
}
