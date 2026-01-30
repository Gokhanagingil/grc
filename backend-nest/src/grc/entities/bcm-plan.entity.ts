import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { User } from '../../users/user.entity';
import { BcmPlanType, BcmPlanStatus } from '../enums';
import { BcmService } from './bcm-service.entity';
import { BcmPlanStep } from './bcm-plan-step.entity';

/**
 * BCM Plan Entity
 *
 * Represents a Business Continuity Plan, Disaster Recovery Plan, or IT Continuity Plan.
 * Plans are linked to a BCM Service and contain recovery steps.
 * Extends BaseEntity for standard audit fields.
 */
@Entity('bcm_plans')
@Index(['tenantId', 'serviceId'])
@Index(['tenantId', 'planType'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'ownerUserId'])
@Index(['tenantId', 'createdAt'])
export class BcmPlan extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @ManyToOne(() => BcmService, (service) => service.plans, { nullable: false })
  @JoinColumn({ name: 'service_id' })
  service: BcmService;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    name: 'plan_type',
    type: 'enum',
    enum: BcmPlanType,
    default: BcmPlanType.BCP,
  })
  planType: BcmPlanType;

  @Column({
    type: 'enum',
    enum: BcmPlanStatus,
    default: BcmPlanStatus.DRAFT,
  })
  status: BcmPlanStatus;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;

  @Column({ name: 'approver_user_id', type: 'uuid', nullable: true })
  approverUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approver_user_id' })
  approver: User | null;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'text', nullable: true })
  triggers: string | null;

  @Column({ name: 'recovery_steps', type: 'text', nullable: true })
  recoverySteps: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => BcmPlanStep, (step) => step.plan)
  steps: BcmPlanStep[];
}
