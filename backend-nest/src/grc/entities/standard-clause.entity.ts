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
 * Represents a hierarchical clause/control/article within a standard.
 * Supports self-referencing for parent-child hierarchy.
 * Examples: ISO 27001 A.5.1, COBIT DSS01.04, NIST PR.DS-01
 * Extends BaseEntity for standard audit fields.
 */
@Entity('grc_standard_clauses')
@Index(['tenantId', 'standardId', 'code'], { unique: true })
@Index(['tenantId', 'standardId', 'parentClauseId'])
@Index(['tenantId', 'standardId', 'level'])
@Index(['tenantId', 'path'])
export class StandardClause extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'standard_id', type: 'uuid' })
  @Index()
  standardId: string;

  @ManyToOne(() => Standard, (standard) => standard.clauses, { nullable: false })
  @JoinColumn({ name: 'standard_id' })
  standard: Standard;

  @Column({ name: 'parent_clause_id', type: 'uuid', nullable: true })
  parentClauseId: string | null;

  @ManyToOne(() => StandardClause, (clause) => clause.children, { nullable: true })
  @JoinColumn({ name: 'parent_clause_id' })
  parentClause: StandardClause | null;

  @OneToMany(() => StandardClause, (clause) => clause.parentClause)
  children: StandardClause[];

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'description_long', type: 'text', nullable: true })
  descriptionLong: string | null;

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

  @OneToMany('AuditScopeClause', 'clause')
  auditScopes: import('./audit-scope-clause.entity').AuditScopeClause[];

  @OneToMany('GrcIssueClause', 'clause')
  issueClauses: import('./grc-issue-clause.entity').GrcIssueClause[];
}
