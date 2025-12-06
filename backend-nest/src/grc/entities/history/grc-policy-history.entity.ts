import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GrcPolicy } from '../grc-policy.entity';
import { PolicyStatus } from '../../enums';

/**
 * GRC Policy History Entity
 *
 * Stores historical snapshots of policy records for compliance and audit purposes.
 * Each record represents the state of a policy at a specific point in time.
 */
@Entity('grc_policy_history')
@Index(['policyId', 'createdAt'])
@Index(['tenantId', 'createdAt'])
export class GrcPolicyHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'policy_id', type: 'uuid' })
  @Index()
  policyId: string;

  @ManyToOne(() => GrcPolicy, { nullable: false })
  @JoinColumn({ name: 'policy_id' })
  policy: GrcPolicy;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({
    type: 'enum',
    enum: PolicyStatus,
  })
  status: PolicyStatus;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  version: string | null;

  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate: Date | null;

  @Column({ name: 'review_date', type: 'date', nullable: true })
  reviewDate: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy: string | null;

  @Column({ name: 'change_reason', type: 'text', nullable: true })
  changeReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
