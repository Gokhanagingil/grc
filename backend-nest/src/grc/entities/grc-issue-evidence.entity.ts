import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';
import { GrcIssue } from './grc-issue.entity';
import { GrcEvidence } from './grc-evidence.entity';

/**
 * GRC Issue-Evidence Mapping Entity
 *
 * Many-to-many relationship between Issues and Evidence.
 * An issue can have multiple evidence artifacts.
 * An evidence artifact can be linked to multiple issues.
 */
@Entity('grc_issue_evidence')
@Index(['tenantId', 'issueId', 'evidenceId'], { unique: true })
export class GrcIssueEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'issue_id', type: 'uuid' })
  @Index()
  issueId: string;

  @ManyToOne(() => GrcIssue, (issue) => issue.issueEvidence, {
    nullable: false,
  })
  @JoinColumn({ name: 'issue_id' })
  issue: GrcIssue;

  @Column({ name: 'evidence_id', type: 'uuid' })
  @Index()
  evidenceId: string;

  @ManyToOne(() => GrcEvidence, (evidence) => evidence.issueEvidence, {
    nullable: false,
  })
  @JoinColumn({ name: 'evidence_id' })
  evidence: GrcEvidence;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
