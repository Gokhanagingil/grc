import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import {
  BcmExerciseType,
  BcmExerciseStatus,
  BcmExerciseOutcome,
} from '../enums';
import { BcmService } from './bcm-service.entity';
import { BcmPlan } from './bcm-plan.entity';

/**
 * BCM Exercise Entity
 *
 * Represents a BCM exercise or test (tabletop, failover, restore, comms).
 * Exercises are linked to a BCM Service and optionally to a Plan.
 * Extends BaseEntity for standard audit fields.
 */
@Entity('bcm_exercises')
@Index(['tenantId', 'serviceId'])
@Index(['tenantId', 'planId'])
@Index(['tenantId', 'exerciseType'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'scheduledAt'])
@Index(['tenantId', 'createdAt'])
export class BcmExercise extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @ManyToOne(() => BcmService, (service) => service.exercises, {
    nullable: false,
  })
  @JoinColumn({ name: 'service_id' })
  service: BcmService;

  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  planId: string | null;

  @ManyToOne(() => BcmPlan, { nullable: true })
  @JoinColumn({ name: 'plan_id' })
  plan: BcmPlan | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    name: 'exercise_type',
    type: 'enum',
    enum: BcmExerciseType,
    default: BcmExerciseType.TABLETOP,
  })
  exerciseType: BcmExerciseType;

  @Column({
    type: 'enum',
    enum: BcmExerciseStatus,
    default: BcmExerciseStatus.PLANNED,
  })
  status: BcmExerciseStatus;

  @Column({ name: 'scheduled_at', type: 'timestamp', nullable: true })
  scheduledAt: Date | null;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({
    type: 'enum',
    enum: BcmExerciseOutcome,
    nullable: true,
  })
  outcome: BcmExerciseOutcome | null;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ name: 'lessons_learned', type: 'text', nullable: true })
  lessonsLearned: string | null;

  @Column({ name: 'linked_issue_id', type: 'uuid', nullable: true })
  linkedIssueId: string | null;

  @Column({ name: 'linked_capa_id', type: 'uuid', nullable: true })
  linkedCapaId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
