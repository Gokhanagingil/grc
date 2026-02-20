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
import { BcmServiceStatus, BcmCriticalityTier } from '../enums';
import { BcmBia } from './bcm-bia.entity';
import { BcmPlan } from './bcm-plan.entity';
import { BcmExercise } from './bcm-exercise.entity';

/**
 * BCM Service Entity
 *
 * Represents a business service in the Business Continuity Management module.
 * Services are the core unit for BCM - they have BIAs, Plans, and Exercises.
 * Extends BaseEntity for standard audit fields.
 */
@Entity('bcm_services')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'criticalityTier'])
@Index(['tenantId', 'businessOwnerUserId'])
@Index(['tenantId', 'itOwnerUserId'])
@Index(['tenantId', 'createdAt'])
export class BcmService extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: BcmServiceStatus,
    default: BcmServiceStatus.DRAFT,
  })
  status: BcmServiceStatus;

  @Column({
    name: 'criticality_tier',
    type: 'enum',
    enum: BcmCriticalityTier,
    nullable: true,
  })
  criticalityTier: BcmCriticalityTier | null;

  @Column({ name: 'business_owner_user_id', type: 'uuid', nullable: true })
  businessOwnerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'business_owner_user_id' })
  businessOwner: User | null;

  @Column({ name: 'it_owner_user_id', type: 'uuid', nullable: true })
  itOwnerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'it_owner_user_id' })
  itOwner: User | null;

  @Column({ type: 'jsonb', nullable: true })
  tags: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => BcmBia, (bia) => bia.service)
  bias: BcmBia[];

  @OneToMany(() => BcmPlan, (plan) => plan.service)
  plans: BcmPlan[];

  @OneToMany(() => BcmExercise, (exercise) => exercise.service)
  exercises: BcmExercise[];
}
