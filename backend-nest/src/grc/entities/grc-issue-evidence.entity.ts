import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { MappingEntityBase } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { GrcIssue } from './grc-issue.entity';
import { GrcEvidence } from './grc-evidence.entity';

/**
 * GRC Issue-Evidence Mapping Entity
 *
 * Many-to-many relationship between Issues and Evidence.
 * An issue can have multiple evidence artifacts.
 * An evidence artifact can be linked to multiple issues.
 * Extends MappingEntityBase for standard mapping fields.
 */
@Entity('grc_issue_evidence')
@Index(['tenantId', 'issueId', 'evidenceId'], { unique: true })
export class GrcIssueEvidence extends MappingEntityBase {
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
}
