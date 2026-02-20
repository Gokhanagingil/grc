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
 * Clause Level Enum
 * Represents the hierarchy level of a clause within a standard
 */
export enum ClauseLevel {
  DOMAIN = 1,
  CLAUSE = 2,
  SUB_CLAUSE = 3,
  CONTROL = 4,
}

/**
 * Standard Clause Entity
 *
 * Represents a clause within a standard (e.g., "A.5.1.1" in ISO 27001).
 * Represents a hierarchical clause/control/article within a standard.
 * Clauses can have a parent-child hierarchy to represent nested requirements.
 * Supports self-referencing for parent-child hierarchy.
 * Examples: ISO 27001 A.5.1, COBIT DSS01.04, NIST PR.DS-01
 * Extends BaseEntity for standard audit fields.
 */
@Entity('standard_clauses')
@Index(['tenantId', 'standardId', 'code'], { unique: true })
@Index(['tenantId', 'standardId'])
@Index(['tenantId', 'parentId'])
@Index(['tenantId', 'code'])
@Index(['tenantId', 'standardId', 'level'])
@Index(['tenantId', 'path'])
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

  @Column({ name: 'description_long', type: 'text', nullable: true })
  descriptionLong: string | null;

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

  @Column({ type: 'integer', default: 1 })
  level: number;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  path: string | null;

  @Column({ name: 'is_auditable', type: 'boolean', default: true })
  isAuditable: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => AuditScopeClause, (asc) => asc.clause)
  auditScopes: AuditScopeClause[];

  @OneToMany(() => GrcIssueClause, (gic) => gic.clause)
  issueClauses: GrcIssueClause[];
}
