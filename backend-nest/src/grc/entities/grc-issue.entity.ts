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
import { IssueType, IssueStatus, IssueSeverity } from '../enums';
import { GrcRisk } from './grc-risk.entity';
import { GrcControl } from './grc-control.entity';
import { GrcCapa } from './grc-capa.entity';
import { GrcIssueEvidence } from './grc-issue-evidence.entity';
import { GrcAudit } from './grc-audit.entity';
import { GrcIssueRequirement } from './grc-issue-requirement.entity';
import { GrcIssueClause } from './grc-issue-clause.entity';

/**
 * GRC Issue Entity
 *
 * Represents an issue or finding discovered during audits, assessments,
 * or incidents. Issues can be linked to risks and controls, and may
 * have associated CAPAs (Corrective/Preventive Actions).
 * Extends BaseEntity for standard audit fields.
 */
@Entity('grc_issues')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'severity'])
@Index(['tenantId', 'riskId'])
@Index(['tenantId', 'controlId'])
@Index(['tenantId', 'auditId'])
@Index(['tenantId', 'status', 'createdAt'])
export class GrcIssue extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: IssueType,
    default: IssueType.OTHER,
  })
  type: IssueType;

  @Column({
    type: 'enum',
    enum: IssueStatus,
    default: IssueStatus.OPEN,
  })
  status: IssueStatus;

  @Column({
    type: 'enum',
    enum: IssueSeverity,
    default: IssueSeverity.MEDIUM,
  })
  severity: IssueSeverity;

  @Column({ name: 'risk_id', type: 'uuid', nullable: true })
  riskId: string | null;

  @ManyToOne(() => GrcRisk, (risk) => risk.issues, { nullable: true })
  @JoinColumn({ name: 'risk_id' })
  risk: GrcRisk | null;

  @Column({ name: 'control_id', type: 'uuid', nullable: true })
  controlId: string | null;

  @ManyToOne(() => GrcControl, (control) => control.issues, { nullable: true })
  @JoinColumn({ name: 'control_id' })
  control: GrcControl | null;

  @Column({ name: 'audit_id', type: 'uuid', nullable: true })
  auditId: string | null;

  @ManyToOne(() => GrcAudit, { nullable: true })
  @JoinColumn({ name: 'audit_id' })
  audit: GrcAudit | null;

  @Column({ name: 'raised_by_user_id', type: 'uuid', nullable: true })
  raisedByUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'raised_by_user_id' })
  raisedBy: User | null;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;

  @Column({ name: 'discovered_date', type: 'date', nullable: true })
  discoveredDate: Date | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ name: 'resolved_date', type: 'date', nullable: true })
  resolvedDate: Date | null;

  @Column({ name: 'root_cause', type: 'text', nullable: true })
  rootCause: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => GrcCapa, (capa) => capa.issue)
  capas: GrcCapa[];

  @OneToMany(() => GrcIssueEvidence, (ie) => ie.issue)
  issueEvidence: GrcIssueEvidence[];

  @OneToMany(() => GrcIssueRequirement, (ir) => ir.issue)
  issueRequirements: GrcIssueRequirement[];

  @OneToMany(() => GrcIssueClause, (ic) => ic.issue)
  issueClauses: GrcIssueClause[];
}
