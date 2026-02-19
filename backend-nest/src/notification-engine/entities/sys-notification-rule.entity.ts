import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  WEBHOOK = 'WEBHOOK',
}

export enum RecipientType {
  ROLE = 'ROLE',
  USER_FIELD = 'USER_FIELD',
  STATIC_EMAIL = 'STATIC_EMAIL',
}

export interface RecipientConfig {
  type: RecipientType;
  value: string;
}

@Entity('sys_notification_rules')
@Index(['tenantId', 'eventName'])
@Index(['tenantId', 'isActive'])
export class SysNotificationRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, name: 'event_name' })
  eventName: string;

  @Column({ type: 'jsonb', default: '{}' })
  condition: Record<string, unknown>;

  @Column({ type: 'jsonb', default: '["IN_APP"]' })
  channels: NotificationChannel[];

  @Column({ type: 'jsonb', default: '[]' })
  recipients: RecipientConfig[];

  @Column({ type: 'uuid', name: 'template_id', nullable: true })
  templateId: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'int', name: 'rate_limit_per_hour', default: 100 })
  rateLimitPerHour: number;

  @Column({ type: 'varchar', length: 128, name: 'table_name', nullable: true })
  tableName: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
