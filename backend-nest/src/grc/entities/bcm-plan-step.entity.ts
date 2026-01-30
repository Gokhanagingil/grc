import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { BcmPlanStepStatus } from '../enums';
import { BcmPlan } from './bcm-plan.entity';

/**
 * BCM Plan Step Entity
 *
 * Represents a step in a BCM Plan's recovery procedure.
 * Steps are ordered and contain role responsibilities and time estimates.
 * Extends BaseEntity for standard audit fields.
 */
@Entity('bcm_plan_steps')
@Index(['tenantId', 'planId'])
@Index(['tenantId', 'planId', 'order'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'createdAt'])
export class BcmPlanStep extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @ManyToOne(() => BcmPlan, (plan) => plan.steps, { nullable: false })
  @JoinColumn({ name: 'plan_id' })
  plan: BcmPlan;

  @Column({ name: 'step_order', type: 'int' })
  order: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'role_responsible',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  roleResponsible: string | null;

  @Column({ name: 'estimated_minutes', type: 'int', nullable: true })
  estimatedMinutes: number | null;

  @Column({
    type: 'enum',
    enum: BcmPlanStepStatus,
    default: BcmPlanStepStatus.PLANNED,
  })
  status: BcmPlanStepStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
