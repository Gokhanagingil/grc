import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * User-level notification preferences.
 * Controls opt-in/opt-out for various notification channels.
 */
@Entity('sys_notification_preferences')
@Index(['tenantId', 'userId'], { unique: true })
export class SysNotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  /** Receive notifications when a task is assigned to you */
  @Column({ name: 'notify_on_assignment', default: true })
  notifyOnAssignment: boolean;

  /** Receive notifications when tasks are approaching due date */
  @Column({ name: 'notify_on_due_date', default: true })
  notifyOnDueDate: boolean;

  /** Receive notifications when a task is assigned to your group (default OFF to prevent spam) */
  @Column({ name: 'notify_on_group_assignment', default: false })
  notifyOnGroupAssignment: boolean;

  /** Receive system notifications */
  @Column({ name: 'notify_on_system', default: true })
  notifyOnSystem: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
