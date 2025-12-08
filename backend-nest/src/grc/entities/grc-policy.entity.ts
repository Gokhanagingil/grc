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
import { PolicyStatus } from '../enums';
import { GrcPolicyControl } from './grc-policy-control.entity';
import { GrcRiskPolicy } from './grc-risk-policy.entity';

/**
 * GRC Policy Entity
 *
 * Represents an organizational policy document with lifecycle management.
 * Policies can be linked to controls via GrcPolicyControl mapping.
 * Extends BaseEntity for standard audit fields.
 */
@Entity('grc_policies')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'category'])
@Index(['tenantId', 'code'], { unique: true, where: 'code IS NOT NULL' })
@Index(['tenantId', 'status', 'createdAt'])
export class GrcPolicy extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @Column({ type: 'varchar', length: 20, default: '1.0' })
  version: string;

  @Column({
    type: 'enum',
    enum: PolicyStatus,
    default: PolicyStatus.DRAFT,
  })
  status: PolicyStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;

  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate: Date | null;

  @Column({ name: 'review_date', type: 'date', nullable: true })
  reviewDate: Date | null;

  @Column({ name: 'approved_by_user_id', type: 'uuid', nullable: true })
  approvedByUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by_user_id' })
  approvedBy: User | null;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => GrcPolicyControl, (pc) => pc.policy)
  policyControls: GrcPolicyControl[];

  @OneToMany(() => GrcRiskPolicy, (rp) => rp.policy)
  riskPolicies: GrcRiskPolicy[];
}
