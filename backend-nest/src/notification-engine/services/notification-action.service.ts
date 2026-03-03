import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TodoTask } from '../../todos/entities/todo-task.entity';
import { SysGroupMembership } from '../../groups/entities/group-membership.entity';
import { SysGroup } from '../../groups/entities/group.entity';
import { TodoBoard } from '../../todos/entities/todo-board.entity';
import { TodoTag } from '../../todos/entities/todo-tag.entity';
import { TodoTaskTag } from '../../todos/entities/todo-task-tag.entity';
import {
  SysUserNotification,
  NotificationAction,
  ActionDangerLevel,
  EntitySnapshot,
} from '../entities/sys-user-notification.entity';
import { StructuredLoggerService } from '../../common/logger';

/** Server-side allowlist of safe action types for v1.2 */
export const ALLOWED_SAFE_ACTIONS = new Set([
  'OPEN_ENTITY',
  'OPEN_RECORD',
  'MARK_READ',
  'SNOOZE',
  'ASSIGN_TO_ME',
  'SET_DUE_DATE',
  'CREATE_FOLLOWUP_TODO',
]);

export interface ActionExecutionResult {
  executed: boolean;
  actionType: string;
  updatedSnapshot?: EntitySnapshot;
  updatedEntity?: Record<string, unknown>;
  auditEntry: {
    action: string;
    userId: string;
    tenantId: string;
    entityType?: string;
    entityId?: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    timestamp: string;
  };
  [key: string]: unknown;
}

/**
 * Suggested next steps configuration by notification type.
 * Each entry maps a notification type to an array of suggested action descriptors.
 */
export interface SuggestedAction {
  label: string;
  actionType: string;
  requiresConfirm: boolean;
  dangerLevel: ActionDangerLevel;
  payload?: Record<string, unknown>;
}

export const SUGGESTION_PACKS: Record<string, SuggestedAction[]> = {
  ASSIGNMENT: [
    {
      label: 'Assign to Me',
      actionType: 'ASSIGN_TO_ME',
      requiresConfirm: true,
      dangerLevel: ActionDangerLevel.SAFE,
    },
    {
      label: 'Set Due Date',
      actionType: 'SET_DUE_DATE',
      requiresConfirm: true,
      dangerLevel: ActionDangerLevel.SAFE,
    },
    {
      label: 'Create Follow-up',
      actionType: 'CREATE_FOLLOWUP_TODO',
      requiresConfirm: true,
      dangerLevel: ActionDangerLevel.SAFE,
    },
  ],
  DUE_DATE: [
    {
      label: 'Snooze',
      actionType: 'SNOOZE',
      requiresConfirm: false,
      dangerLevel: ActionDangerLevel.SAFE,
    },
    {
      label: 'Set Due Date',
      actionType: 'SET_DUE_DATE',
      requiresConfirm: true,
      dangerLevel: ActionDangerLevel.SAFE,
    },
    {
      label: 'Create Follow-up',
      actionType: 'CREATE_FOLLOWUP_TODO',
      requiresConfirm: true,
      dangerLevel: ActionDangerLevel.SAFE,
    },
  ],
  GROUP_ASSIGNMENT: [
    {
      label: 'Assign to Me',
      actionType: 'ASSIGN_TO_ME',
      requiresConfirm: true,
      dangerLevel: ActionDangerLevel.SAFE,
    },
    {
      label: 'Set Due Date',
      actionType: 'SET_DUE_DATE',
      requiresConfirm: true,
      dangerLevel: ActionDangerLevel.SAFE,
    },
  ],
};

@Injectable()
export class NotificationActionService {
  private readonly logger: StructuredLoggerService;

  constructor(
    @InjectRepository(TodoTask)
    private readonly taskRepo: Repository<TodoTask>,
    @InjectRepository(SysGroupMembership)
    private readonly membershipRepo: Repository<SysGroupMembership>,
    @InjectRepository(SysGroup)
    private readonly groupRepo: Repository<SysGroup>,
    @InjectRepository(TodoBoard)
    private readonly boardRepo: Repository<TodoBoard>,
    @InjectRepository(TodoTag)
    private readonly tagRepo: Repository<TodoTag>,
    @InjectRepository(TodoTaskTag)
    private readonly taskTagRepo: Repository<TodoTaskTag>,
    @InjectRepository(SysUserNotification)
    private readonly userNotificationRepo: Repository<SysUserNotification>,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('NotificationActionService');
  }

  /**
   * Validate that an action type is on the server-side allowlist.
   */
  isActionAllowed(actionType: string): boolean {
    return ALLOWED_SAFE_ACTIONS.has(actionType);
  }

  /**
   * Execute ASSIGN_TO_ME action.
   *
   * Rules:
   * - If task has ownerGroupId: user must be a member of that group OR have admin role
   * - If no group: user must have edit permission (simplified: they can update)
   * - Logs audit entry with before/after assignedToUserId
   * - Returns updated entity snapshot
   */
  async executeAssignToMe(
    tenantId: string,
    userId: string,
    userRole: string,
    notification: SysUserNotification,
    payload: Record<string, unknown>,
  ): Promise<ActionExecutionResult> {
    // Server-authoritative: always use notification's entity references (defense-in-depth)
    const entityId = notification.entityId;
    const entityType = notification.entityType;

    if (entityType !== 'todo_task' || !entityId) {
      throw new BadRequestException('ASSIGN_TO_ME only supports todo_task entities');
    }

    const task = await this.taskRepo.findOne({
      where: { id: entityId, tenantId, isDeleted: false },
    });
    if (!task) throw new NotFoundException('Task not found');

    // Permission check: group membership or admin
    if (task.ownerGroupId) {
      const isAdmin = userRole === 'ADMIN' || userRole === 'admin';
      if (!isAdmin) {
        const membership = await this.membershipRepo.findOne({
          where: { tenantId, groupId: task.ownerGroupId, userId },
        });
        if (!membership) {
          throw new ForbiddenException(
            'You must be a member of the assignment group or an admin to assign this task to yourself',
          );
        }
      }
    }

    const previousAssignee = task.assigneeUserId;
    task.assigneeUserId = userId;
    task.updatedBy = userId;
    await this.taskRepo.save(task);

    // Build updated snapshot
    const updatedSnapshot = await this.buildTaskSnapshot(tenantId, task);

    // Update notification snapshot
    await this.updateNotificationSnapshot(notification.id, updatedSnapshot);

    const auditEntry = {
      action: 'ASSIGN_TO_ME',
      userId,
      tenantId,
      entityType: 'todo_task',
      entityId,
      before: { assignedToUserId: previousAssignee },
      after: { assignedToUserId: userId },
      timestamp: new Date().toISOString(),
    };

    this.logger.log('ASSIGN_TO_ME executed', auditEntry);

    return {
      executed: true,
      actionType: 'ASSIGN_TO_ME',
      updatedSnapshot,
      updatedEntity: {
        id: task.id,
        assigneeUserId: task.assigneeUserId,
        title: task.title,
      },
      auditEntry,
    };
  }

  /**
   * Execute SET_DUE_DATE action.
   *
   * Rules:
   * - User must have permission to edit the task (simplified: task exists in tenant)
   * - Validates the new due date
   * - Logs audit entry with before/after dueDate
   * - Returns updated entity snapshot
   */
  async executeSetDueDate(
    tenantId: string,
    userId: string,
    notification: SysUserNotification,
    payload: Record<string, unknown>,
  ): Promise<ActionExecutionResult> {
    // Server-authoritative: always use notification's entity references (defense-in-depth)
    const entityId = notification.entityId;
    const entityType = notification.entityType;
    const newDueDate = payload.dueDate as string;

    if (entityType !== 'todo_task' || !entityId) {
      throw new BadRequestException('SET_DUE_DATE only supports todo_task entities');
    }

    if (!newDueDate) {
      throw new BadRequestException('dueDate is required in payload');
    }

    const parsedDate = new Date(newDueDate);
    if (isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Invalid dueDate format');
    }

    const task = await this.taskRepo.findOne({
      where: { id: entityId, tenantId, isDeleted: false },
    });
    if (!task) throw new NotFoundException('Task not found');

    const previousDueDate = task.dueDate ? task.dueDate.toISOString() : null;
    task.dueDate = parsedDate;
    task.updatedBy = userId;
    await this.taskRepo.save(task);

    // Build updated snapshot
    const updatedSnapshot = await this.buildTaskSnapshot(tenantId, task);

    // Update notification snapshot
    await this.updateNotificationSnapshot(notification.id, updatedSnapshot);

    const auditEntry = {
      action: 'SET_DUE_DATE',
      userId,
      tenantId,
      entityType: 'todo_task',
      entityId,
      before: { dueDate: previousDueDate },
      after: { dueDate: parsedDate.toISOString() },
      timestamp: new Date().toISOString(),
    };

    this.logger.log('SET_DUE_DATE executed', auditEntry);

    return {
      executed: true,
      actionType: 'SET_DUE_DATE',
      updatedSnapshot,
      updatedEntity: {
        id: task.id,
        dueDate: task.dueDate,
        title: task.title,
      },
      auditEntry,
    };
  }

  /**
   * Execute CREATE_FOLLOWUP_TODO action.
   *
   * Creates a new To-Do task linked to the original entity via metadata.
   * Default fields: title from original + " (follow-up)", due date optional, assigned to current user.
   */
  async executeCreateFollowupTodo(
    tenantId: string,
    userId: string,
    notification: SysUserNotification,
    payload: Record<string, unknown>,
  ): Promise<ActionExecutionResult> {
    const entityId = notification.entityId;
    const entityType = notification.entityType;

    // Get original task title for default title
    let originalTitle = notification.title || 'Follow-up task';
    if (entityType === 'todo_task' && entityId) {
      const originalTask = await this.taskRepo.findOne({
        where: { id: entityId, tenantId, isDeleted: false },
      });
      if (originalTask) {
        originalTitle = originalTask.title;
      }
    }

    const title = (payload.title as string) || `${originalTitle} (follow-up)`;
    const rawDueDate = payload.dueDate as string | undefined;
    let dueDate: Date | null = null;
    if (rawDueDate) {
      dueDate = new Date(rawDueDate);
      if (isNaN(dueDate.getTime())) {
        throw new BadRequestException('Invalid dueDate format');
      }
    }

    // Compute sortOrder
    const maxResult = await this.taskRepo
      .createQueryBuilder('t')
      .select('COALESCE(MAX(t.sort_order), 0)', 'maxSort')
      .where('t.tenant_id = :tenantId', { tenantId })
      .andWhere('t.status = :status', { status: 'todo' })
      .andWhere('t.is_deleted = false')
      .getRawOne();
    const sortOrder = ((maxResult?.maxSort as number) ?? 0) + 1;

    const newTask = this.taskRepo.create({
      tenantId,
      createdBy: userId,
      title,
      description: `Follow-up from notification: ${notification.title}`,
      status: 'todo',
      priority: 'medium',
      dueDate,
      assigneeUserId: userId,
      sortOrder,
    });
    const saved = await this.taskRepo.save(newTask);

    const auditEntry = {
      action: 'CREATE_FOLLOWUP_TODO',
      userId,
      tenantId,
      entityType: 'todo_task',
      entityId: saved.id,
      before: {},
      after: {
        id: saved.id,
        title: saved.title,
        linkedTo: entityId ? { entityType, entityId } : undefined,
      },
      timestamp: new Date().toISOString(),
    };

    this.logger.log('CREATE_FOLLOWUP_TODO executed', auditEntry);

    return {
      executed: true,
      actionType: 'CREATE_FOLLOWUP_TODO',
      createdTaskId: saved.id,
      createdTask: {
        id: saved.id,
        title: saved.title,
        status: saved.status,
        assigneeUserId: saved.assigneeUserId,
        dueDate: saved.dueDate,
      },
      auditEntry,
    };
  }

  /**
   * Build a rich task snapshot for notification preview cards.
   * Includes board name, group name, assignedTo display, tags.
   */
  async buildTaskSnapshot(
    tenantId: string,
    task: TodoTask,
  ): Promise<EntitySnapshot> {
    const keyFields: Array<{ label: string; value: string }> = [];

    // Due date
    if (task.dueDate) {
      keyFields.push({
        label: 'Due',
        value: new Date(task.dueDate).toISOString().split('T')[0],
      });
    }

    // Priority
    if (task.priority) {
      keyFields.push({ label: 'Priority', value: task.priority });
    }

    // Board name
    if (task.boardId) {
      const board = await this.boardRepo.findOne({
        where: { id: task.boardId, tenantId, isDeleted: false },
      });
      if (board) {
        keyFields.push({ label: 'Board', value: board.name });
      }
    }

    // Assignment group name
    if (task.ownerGroupId) {
      const group = await this.groupRepo.findOne({
        where: { id: task.ownerGroupId, tenantId },
      });
      if (group) {
        keyFields.push({ label: 'Group', value: group.name });
      }
    }

    // Tags
    const taskTags = await this.taskTagRepo.find({
      where: { taskId: task.id, tenantId },
      relations: ['tag'],
    });
    const tagNames = taskTags
      .filter((tt) => tt.tag && !tt.tag.isDeleted)
      .map((tt) => tt.tag.name);
    if (tagNames.length > 0) {
      keyFields.push({ label: 'Tags', value: tagNames.join(', ') });
    }

    // Status
    keyFields.push({ label: 'Status', value: task.status });

    return {
      primaryLabel: task.title,
      secondaryLabel: task.assigneeUserId
        ? `Assigned to user`
        : 'Unassigned',
      keyFields,
    };
  }

  /**
   * Get suggested next steps for a notification type.
   */
  getSuggestedActions(
    notificationType: string,
    notification: SysUserNotification,
  ): NotificationAction[] {
    const pack = SUGGESTION_PACKS[notificationType];
    if (!pack) return [];

    return pack.map((suggestion, idx) => ({
      id: `suggestion_${idx}`,
      label: suggestion.label,
      actionType: suggestion.actionType,
      requiresConfirm: suggestion.requiresConfirm,
      dangerLevel: suggestion.dangerLevel,
      payload: {
        ...suggestion.payload,
        entityType: notification.entityType,
        entityId: notification.entityId,
      },
    }));
  }

  /**
   * Update the snapshot stored in the notification's metadata.
   */
  private async updateNotificationSnapshot(
    notificationId: string,
    snapshot: EntitySnapshot,
  ): Promise<void> {
    const notification = await this.userNotificationRepo.findOne({
      where: { id: notificationId },
    });
    if (!notification) return;

    const metadata = notification.metadata || {};
    const updatedMetadata = { ...metadata, snapshot };

    await this.userNotificationRepo
      .createQueryBuilder()
      .update()
      .set({ metadata: updatedMetadata })
      .where('id = :id', { id: notificationId })
      .execute();
  }
}
