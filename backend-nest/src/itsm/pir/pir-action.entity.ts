import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { PirActionStatus, PirActionPriority } from './pir.enums';

/**
 * ITSM PIR Action Entity
 *
 * Represents action items / tasks created from a PIR.
 * Can be linked to Problem, Change, or Risk Observation records.
 */
@Entity('itsm_pir_actions')
@Index(['tenantId', 'pirId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'ownerId'])
@Index(['tenantId', 'dueDate'])
export class ItsmPirAction extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'pir_id', type: 'uuid' })
  pirId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId: string | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string | null;

  @Column({
    type: 'enum',
    enum: PirActionStatus,
    enumName: 'pir_action_status_enum',
    default: PirActionStatus.OPEN,
  })
  status: PirActionStatus;

  @Column({
    type: 'enum',
    enum: PirActionPriority,
    enumName: 'pir_action_priority_enum',
    default: PirActionPriority.MEDIUM,
  })
  priority: PirActionPriority;

  // === Optional Links ===
  @Column({ name: 'problem_id', type: 'uuid', nullable: true })
  problemId: string | null;

  @Column({ name: 'change_id', type: 'uuid', nullable: true })
  changeId: string | null;

  @Column({ name: 'risk_observation_id', type: 'uuid', nullable: true })
  riskObservationId: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
