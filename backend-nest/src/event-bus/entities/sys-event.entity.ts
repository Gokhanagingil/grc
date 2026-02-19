import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum SysEventStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

@Entity('sys_events')
@Index(['tenantId', 'createdAt'])
@Index(['eventName', 'status'])
@Index(['tableName', 'recordId'])
export class SysEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ type: 'varchar', length: 128 })
  source: string;

  @Column({ type: 'varchar', length: 255, name: 'event_name' })
  eventName: string;

  @Column({ type: 'varchar', length: 128, name: 'table_name', nullable: true })
  tableName: string | null;

  @Column({ type: 'uuid', name: 'record_id', nullable: true })
  recordId: string | null;

  @Column({ type: 'jsonb', name: 'payload_json', default: '{}' })
  payloadJson: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({
    type: 'varchar',
    length: 32,
    default: SysEventStatus.PENDING,
  })
  status: SysEventStatus;

  @Column({ type: 'varchar', length: 255, name: 'actor_id', nullable: true })
  actorId: string | null;
}
