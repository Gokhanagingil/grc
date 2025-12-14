import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { MappingEntityBase } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { GrcAudit } from './grc-audit.entity';
import { StandardClause } from './standard-clause.entity';

/**
 * Clause Scope Status Enum
 * Tracks the audit status of a specific clause within an audit
 */
export enum ClauseScopeStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  NOT_APPLICABLE = 'not_applicable',
}

/**
 * Audit Scope Clause Entity
 *
 * Many-to-many relationship between Audits and Standard Clauses.
 * Represents which specific clauses are included in an audit's scope.
 * An audit can include multiple clauses.
 * A clause can be audited in multiple audits.
 * Tracks the audit status of each clause.
 * Extends MappingEntityBase for standard mapping fields.
 */
@Entity('audit_scope_clauses')
@Index(['tenantId', 'auditId', 'clauseId'], { unique: true })
@Index(['tenantId', 'auditId'])
@Index(['tenantId', 'clauseId'])
export class AuditScopeClause extends MappingEntityBase {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'audit_id', type: 'uuid' })
  @Index()
  auditId: string;

  @ManyToOne(() => GrcAudit, { nullable: false })
  @JoinColumn({ name: 'audit_id' })
  audit: GrcAudit;

  @Column({ name: 'clause_id', type: 'uuid' })
  @Index()
  clauseId: string;

  @ManyToOne(() => StandardClause, (clause) => clause.auditScopes, {
    nullable: false,
  })
  @JoinColumn({ name: 'clause_id' })
  clause: StandardClause;

  @Column({
    type: 'varchar',
    length: 20,
    default: ClauseScopeStatus.NOT_STARTED,
  })
  status: ClauseScopeStatus;

  @Column({ name: 'is_locked', type: 'boolean', default: false })
  isLocked: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
