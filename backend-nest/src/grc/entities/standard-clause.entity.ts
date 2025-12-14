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
import { Standard } from './standard.entity';
import { AuditScopeClause } from './audit-scope-clause.entity';
import { GrcIssueClause } from './grc-issue-clause.entity';

/**
 * Standard Clause Entity
 *
 * Represents a clause within a standard (e.g., "A.5.1.1" in ISO 27001).
 * Clauses can have a parent-child hierarchy to represent nested requirements.
 * Extends BaseEntity for standard audit fields.
 */
@Entity('standard_clauses')
@Index(['tenantId', 'standardId', 'code'], { unique: true })
@Index(['tenantId', 'standardId'])
@Index(['tenantId', 'parentId'])
@Index(['tenantId', 'code'])
export class StandardClause extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'standard_id', type: 'uuid' })
  @Index()
  standardId: string;

  @ManyToOne(() => Standard, (standard) => standard.clauses, {
    nullable: false,
  })
  @JoinColumn({ name: 'standard_id' })
  standard: Standard;

  @Column({ type: 'varchar', length: 100 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  @Index()
  parentId: string | null;

  @ManyToOne(() => StandardClause, (clause) => clause.children, {
    nullable: true,
  })
  @JoinColumn({ name: 'parent_id' })
  parent: StandardClause | null;

  @OneToMany(() => StandardClause, (clause) => clause.parent)
  children: StandardClause[];

  @Column({ name: 'hierarchy_level', type: 'integer', default: 0 })
  hierarchyLevel: number;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => AuditScopeClause, (asc) => asc.clause)
  auditScopes: AuditScopeClause[];

  @OneToMany(() => GrcIssueClause, (gic) => gic.clause)
  issueClauses: GrcIssueClause[];
}
