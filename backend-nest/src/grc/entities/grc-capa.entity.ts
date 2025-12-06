import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { User } from '../../users/user.entity';
import { CapaType, CapaStatus } from '../enums';
import { GrcIssue } from './grc-issue.entity';

/**
 * GRC CAPA Entity
 *
 * Represents a Corrective and/or Preventive Action associated with an issue.
 * CAPAs track the remediation activities taken to address findings.
 * Extends BaseEntity for standard audit fields.
 */
@Entity('grc_capas')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'issueId'])
@Index(['tenantId', 'status', 'createdAt'])
export class GrcCapa extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'issue_id', type: 'uuid' })
  issueId: string;

  @ManyToOne(() => GrcIssue, (issue) => issue.capas, { nullable: false })
  @JoinColumn({ name: 'issue_id' })
  issue: GrcIssue;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: CapaType,
    default: CapaType.CORRECTIVE,
  })
  type: CapaType;

  @Column({
    type: 'enum',
    enum: CapaStatus,
    default: CapaStatus.PLANNED,
  })
  status: CapaStatus;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ name: 'completed_date', type: 'date', nullable: true })
  completedDate: Date | null;

  @Column({ name: 'verified_by_user_id', type: 'uuid', nullable: true })
  verifiedByUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'verified_by_user_id' })
  verifiedBy: User | null;

  @Column({ name: 'verified_at', type: 'timestamp', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  effectiveness: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
