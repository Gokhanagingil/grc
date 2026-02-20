/**
 * Notification Log Entity
 *
 * Audit logging for notification attempts (success/fail) with correlationId.
 * Stores all notification attempts for compliance and debugging purposes.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum NotificationStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  DISABLED = 'disabled',
}

export enum NotificationProviderType {
  EMAIL = 'email',
  WEBHOOK = 'webhook',
}

@Entity('notification_logs')
@Index(['tenantId', 'createdAt'])
@Index(['correlationId'])
@Index(['providerType', 'status'])
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 64, name: 'correlation_id' })
  correlationId: string;

  @Column({
    type: 'enum',
    enum: NotificationProviderType,
    name: 'provider_type',
  })
  providerType: NotificationProviderType;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.SUCCESS,
  })
  status: NotificationStatus;

  @Column({ type: 'varchar', length: 64, name: 'message_code' })
  messageCode: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  subject: string | null;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'varchar', length: 64, name: 'error_code', nullable: true })
  errorCode: string | null;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
