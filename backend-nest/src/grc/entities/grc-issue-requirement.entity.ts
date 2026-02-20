import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { MappingEntityBase } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { GrcIssue } from './grc-issue.entity';
import { GrcRequirement } from './grc-requirement.entity';

/**
 * GRC Issue-Requirement Mapping Entity
 *
 * Many-to-many relationship between Issues (Findings) and Requirements.
 * Links audit findings to the requirements they relate to.
 * An issue/finding can be related to multiple requirements.
 * A requirement can have multiple issues/findings.
 * Extends MappingEntityBase for standard mapping fields.
 */
@Entity('grc_issue_requirements')
@Index(['tenantId', 'issueId', 'requirementId'], { unique: true })
export class GrcIssueRequirement extends MappingEntityBase {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'issue_id', type: 'uuid' })
  @Index()
  issueId: string;

  @ManyToOne(() => GrcIssue, (issue) => issue.issueRequirements, {
    nullable: false,
  })
  @JoinColumn({ name: 'issue_id' })
  issue: GrcIssue;

  @Column({ name: 'requirement_id', type: 'uuid' })
  @Index()
  requirementId: string;

  @ManyToOne(
    () => GrcRequirement,
    (requirement) => requirement.issueRequirements,
    {
      nullable: false,
    },
  )
  @JoinColumn({ name: 'requirement_id' })
  requirement: GrcRequirement;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
