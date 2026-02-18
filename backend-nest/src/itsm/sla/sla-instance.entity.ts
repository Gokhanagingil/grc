import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { SlaDefinition } from './sla-definition.entity';

export enum SlaInstanceStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  PAUSED = 'PAUSED',
  MET = 'MET',
  BREACHED = 'BREACHED',
  CANCELLED = 'CANCELLED',
}

@Entity('itsm_sla_instances')
@Index(['tenantId', 'recordType', 'recordId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'breached'])
@Index(['tenantId', 'dueAt'])
export class SlaInstance extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'record_type', type: 'varchar', length: 50 })
  recordType: string;

  @Column({ name: 'record_id', type: 'uuid' })
  recordId: string;

  @Column({ name: 'definition_id', type: 'uuid' })
  definitionId: string;

  @ManyToOne(() => SlaDefinition, { nullable: false })
  @JoinColumn({ name: 'definition_id' })
  definition: SlaDefinition;

  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt: Date;

  @Column({ name: 'due_at', type: 'timestamptz' })
  dueAt: Date;

  @Column({ name: 'stop_at', type: 'timestamptz', nullable: true })
  stopAt: Date | null;

  @Column({ name: 'pause_at', type: 'timestamptz', nullable: true })
  pauseAt: Date | null;

  @Column({ name: 'paused_duration_seconds', type: 'int', default: 0 })
  pausedDurationSeconds: number;

  @Column({ type: 'boolean', default: false })
  breached: boolean;

  @Column({ name: 'elapsed_seconds', type: 'int', default: 0 })
  elapsedSeconds: number;

  @Column({ name: 'remaining_seconds', type: 'int', nullable: true })
  remainingSeconds: number | null;

  @Column({
    type: 'enum',
    enum: SlaInstanceStatus,
    default: SlaInstanceStatus.IN_PROGRESS,
  })
  status: SlaInstanceStatus;
}
