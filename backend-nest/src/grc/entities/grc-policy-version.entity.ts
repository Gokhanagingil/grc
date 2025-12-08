import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { User } from '../../users/user.entity';
import { GrcPolicy } from './grc-policy.entity';
import { PolicyVersionStatus } from '../enums';

/**
 * GRC Policy Version Entity
 *
 * Represents a specific version of a policy document.
 * Supports versioning workflow: draft -> in_review -> approved -> published -> retired
 * Each policy can have multiple versions with different content and status.
 */
@Entity('grc_policy_versions')
@Index(['tenantId', 'policyId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'policyId', 'versionNumber'], { unique: true })
export class GrcPolicyVersion extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'policy_id', type: 'uuid' })
  policyId: string;

  @ManyToOne(() => GrcPolicy, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_id' })
  policy: GrcPolicy;

  @Column({ name: 'version_number', type: 'varchar', length: 20 })
  versionNumber: string;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ name: 'change_summary', type: 'text', nullable: true })
  changeSummary: string | null;

  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate: Date | null;

  @Column({
    type: 'enum',
    enum: PolicyVersionStatus,
    default: PolicyVersionStatus.DRAFT,
  })
  status: PolicyVersionStatus;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'published_by_user_id', type: 'uuid', nullable: true })
  publishedByUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'published_by_user_id' })
  publishedBy: User | null;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'approved_by_user_id', type: 'uuid', nullable: true })
  approvedByUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by_user_id' })
  approvedBy: User | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
