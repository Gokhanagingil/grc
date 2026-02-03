import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { User } from '../../users/user.entity';
import {
  ItsmChangeType,
  ItsmChangeState,
  ItsmChangeRisk,
  ItsmApprovalStatus,
} from '../enums';
import { ItsmService } from './itsm-service.entity';

/**
 * ITSM Change Entity
 *
 * Represents a change request in the ITSM module (ITIL v5 aligned).
 * Changes track additions, modifications, or removals of IT services or components.
 *
 * Key ITIL v5 principles:
 * - Value-focused: Links to services to understand business impact
 * - Risk-aware: Risk level assessment for change advisory board decisions
 * - Measurable: State transitions with planned/actual timestamps
 * - Audit trail ready: Extends BaseEntity for full audit history
 */
@Entity('itsm_changes')
@Index(['tenantId', 'state'])
@Index(['tenantId', 'type'])
@Index(['tenantId', 'risk'])
@Index(['tenantId', 'approvalStatus'])
@Index(['tenantId', 'serviceId'])
@Index(['tenantId', 'number'], { unique: true })
export class ItsmChange extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 50 })
  number: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: ItsmChangeType,
    default: ItsmChangeType.NORMAL,
  })
  type: ItsmChangeType;

  @Column({
    type: 'enum',
    enum: ItsmChangeState,
    default: ItsmChangeState.DRAFT,
  })
  state: ItsmChangeState;

  @Column({
    type: 'enum',
    enum: ItsmChangeRisk,
    default: ItsmChangeRisk.MEDIUM,
  })
  risk: ItsmChangeRisk;

  @Column({
    name: 'approval_status',
    type: 'enum',
    enum: ItsmApprovalStatus,
    default: ItsmApprovalStatus.NOT_REQUESTED,
  })
  approvalStatus: ItsmApprovalStatus;

  @Column({ name: 'requester_id', type: 'uuid', nullable: true })
  requesterId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'requester_id' })
  requester: User | null;

  @Column({ name: 'assignee_id', type: 'uuid', nullable: true })
  assigneeId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assignee_id' })
  assignee: User | null;

  @Column({ name: 'service_id', type: 'uuid', nullable: true })
  serviceId: string | null;

  @ManyToOne(() => ItsmService, { nullable: true })
  @JoinColumn({ name: 'service_id' })
  service: ItsmService | null;

  @Column({ name: 'planned_start_at', type: 'timestamptz', nullable: true })
  plannedStartAt: Date | null;

  @Column({ name: 'planned_end_at', type: 'timestamptz', nullable: true })
  plannedEndAt: Date | null;

  @Column({ name: 'actual_start_at', type: 'timestamptz', nullable: true })
  actualStartAt: Date | null;

  @Column({ name: 'actual_end_at', type: 'timestamptz', nullable: true })
  actualEndAt: Date | null;

  @Column({ name: 'implementation_plan', type: 'text', nullable: true })
  implementationPlan: string | null;

  @Column({ name: 'backout_plan', type: 'text', nullable: true })
  backoutPlan: string | null;

  @Column({ name: 'justification', type: 'text', nullable: true })
  justification: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  // GRC Bridge relationships will be added via join tables
  // itsm_change_risks, itsm_change_controls
}
