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
import { CapaType, CapaStatus, CAPAPriority, SourceType } from '../enums';
import { GrcIssue } from './grc-issue.entity';
import { GrcCapaTask } from './grc-capa-task.entity';

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

  @Column({ name: 'issue_id', type: 'uuid', nullable: true })
  issueId: string | null;

  @ManyToOne(() => GrcIssue, (issue) => issue.capas, { nullable: true })
  @JoinColumn({ name: 'issue_id' })
  issue: GrcIssue | null;

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

  // Golden Flow Phase 1 - New Fields
  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @Column({ name: 'root_cause_analysis', type: 'text', nullable: true })
  rootCauseAnalysis: string | null;

  @Column({ name: 'action_plan', type: 'text', nullable: true })
  actionPlan: string | null;

  @Column({ name: 'implementation_notes', type: 'text', nullable: true })
  implementationNotes: string | null;

  @Column({ name: 'verification_method', type: 'text', nullable: true })
  verificationMethod: string | null;

  @Column({
    name: 'verification_evidence_ids',
    type: 'uuid',
    array: true,
    nullable: true,
  })
  verificationEvidenceIds: string[] | null;

  @Column({ name: 'verification_notes', type: 'text', nullable: true })
  verificationNotes: string | null;

  @Column({ name: 'closure_notes', type: 'text', nullable: true })
  closureNotes: string | null;

  @Column({ name: 'closed_by_user_id', type: 'uuid', nullable: true })
  closedByUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'closed_by_user_id' })
  closedBy: User | null;

  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  closedAt: Date | null;

  @Column({
    type: 'enum',
    enum: CAPAPriority,
    default: CAPAPriority.MEDIUM,
  })
  priority: CAPAPriority;

  @Column({
    name: 'source_type',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  sourceType: SourceType | null;

  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  @Index()
  sourceId: string | null;

  @Column({ name: 'source_ref', type: 'varchar', length: 255, nullable: true })
  sourceRef: string | null;

  @Column({ name: 'source_meta', type: 'jsonb', nullable: true })
  sourceMeta: Record<string, unknown> | null;

  // Relationships
  @OneToMany(() => GrcCapaTask, (task) => task.capa)
  tasks: GrcCapaTask[];
}
