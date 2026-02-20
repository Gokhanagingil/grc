import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum DeliveryStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
}

@Entity('sys_notification_deliveries')
@Index(['tenantId', 'createdAt'])
@Index(['ruleId', 'status'])
export class SysNotificationDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ type: 'uuid', name: 'rule_id' })
  ruleId: string;

  @Column({ type: 'uuid', name: 'event_id', nullable: true })
  eventId: string | null;

  @Column({ type: 'varchar', length: 32 })
  channel: string;

  @Column({ type: 'varchar', length: 500 })
  recipient: string;

  @Column({
    type: 'varchar',
    length: 32,
    default: DeliveryStatus.PENDING,
  })
  status: DeliveryStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'text', name: 'last_error', nullable: true })
  lastError: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'provider_message_id',
    nullable: true,
  })
  providerMessageId: string | null;

  @Column({ type: 'jsonb', name: 'payload_snapshot', default: '{}' })
  payloadSnapshot: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
