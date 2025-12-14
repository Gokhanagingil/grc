import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { MappingEntityBase } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { GrcIssue } from './grc-issue.entity';
import { StandardClause } from './standard-clause.entity';

/**
 * GRC Issue Clause Entity
 *
 * Many-to-many relationship between Issues (Findings) and Standard Clauses.
 * Links audit findings to the specific clauses they relate to.
 * An issue/finding can be related to multiple clauses.
 * A clause can have multiple issues/findings.
 * Extends MappingEntityBase for standard mapping fields.
 */
@Entity('grc_issue_clauses')
@Index(['tenantId', 'issueId', 'clauseId'], { unique: true })
@Index(['tenantId', 'issueId'])
@Index(['tenantId', 'clauseId'])
export class GrcIssueClause extends MappingEntityBase {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'issue_id', type: 'uuid' })
  @Index()
  issueId: string;

  @ManyToOne(() => GrcIssue, { nullable: false })
  @JoinColumn({ name: 'issue_id' })
  issue: GrcIssue;

  @Column({ name: 'clause_id', type: 'uuid' })
  @Index()
  clauseId: string;

  @ManyToOne(() => StandardClause, (clause) => clause.issueClauses, {
    nullable: false,
  })
  @JoinColumn({ name: 'clause_id' })
  clause: StandardClause;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
