import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Notification type constants.
 * Used to categorize notifications by their trigger source.
 */
export enum NotificationType {
  GENERAL = 'GENERAL',
  ASSIGNMENT = 'ASSIGNMENT',
  DUE_DATE = 'DUE_DATE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  MENTION = 'MENTION',
  SYSTEM = 'SYSTEM',
}

/**
 * Notification severity levels.
 * Maps to visual indicators in the UI (color-coded).
 */
export enum NotificationSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

/**
 * Source module that generated the notification.
 */
export enum NotificationSource {
  SYSTEM = 'SYSTEM',
  TODO = 'TODO',
  GRC = 'GRC',
  ITSM = 'ITSM',
}

/**
 * Schema for actionable notification buttons.
 * v0: only "OPEN_RECORD" is wired.
 * Future: TAKE_OWNERSHIP, CREATE_CHANGE, START_CAPA_STEP, etc.
 */
export interface NotificationAction {
  label: string;
  actionType: string;
  payload: Record<string, unknown>;
}

@Entity('sys_user_notifications')
@Index(['userId', 'readAt'])
@Index(['tenantId', 'userId', 'createdAt'])
@Index(['tenantId', 'type'])
@Index(['tenantId', 'source'])
@Index(['entityType', 'entityId'])
export class SysUserNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ type: 'uuid', name: 'user_id' })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  link: string | null;

  @Column({ type: 'uuid', name: 'delivery_id', nullable: true })
  deliveryId: string | null;

  /* ---- v0 additions ---- */

  @Column({ type: 'varchar', length: 64, default: 'GENERAL' })
  type: string;

  @Column({ type: 'varchar', length: 32, default: 'INFO' })
  severity: string;

  @Column({ type: 'varchar', length: 64, default: 'SYSTEM' })
  source: string;

  @Column({ type: 'varchar', length: 128, name: 'entity_type', nullable: true })
  entityType: string | null;

  @Column({ type: 'uuid', name: 'entity_id', nullable: true })
  entityId: string | null;

  @Column({ type: 'timestamp', name: 'due_at', nullable: true })
  dueAt: Date | null;

  @Column({ type: 'jsonb', nullable: true, default: '{}' })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true, default: '[]' })
  actions: NotificationAction[] | null;

  /* ---- timestamps ---- */

  @Column({ type: 'timestamp', name: 'read_at', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
