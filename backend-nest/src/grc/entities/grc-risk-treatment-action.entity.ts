import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { User } from '../../users/user.entity';
import { GrcRisk } from './grc-risk.entity';
import { TreatmentActionStatus } from '../enums';

/**
 * GRC Risk Treatment Action Entity
 *
 * Represents an action/task within a risk treatment plan.
 * Each action is linked to a risk and tracks progress toward
 * mitigating or treating the identified risk.
 * Extends BaseEntity for standard audit fields.
 */
@Entity('grc_risk_treatment_actions')
@Index(['tenantId', 'riskId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'ownerUserId'])
@Index(['tenantId', 'dueDate'])
export class GrcRiskTreatmentAction extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'risk_id', type: 'uuid' })
  riskId: string;

  @ManyToOne(() => GrcRisk, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'risk_id' })
  risk: GrcRisk;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: TreatmentActionStatus,
    default: TreatmentActionStatus.PLANNED,
  })
  status: TreatmentActionStatus;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;

  @Column({
    name: 'owner_display_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  ownerDisplayName: string | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'progress_pct', type: 'int', default: 0 })
  progressPct: number;

  @Column({
    name: 'evidence_link',
    type: 'varchar',
    length: 1024,
    nullable: true,
  })
  evidenceLink: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
