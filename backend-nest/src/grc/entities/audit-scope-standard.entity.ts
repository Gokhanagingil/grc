import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { MappingEntityBase } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { GrcAudit } from './grc-audit.entity';
import { Standard } from './standard.entity';

/**
 * Scope Type Enum
 * Defines whether the full standard or only selected clauses are in scope
 */
export enum ScopeType {
  FULL = 'full',
  PARTIAL = 'partial',
}

/**
 * Audit Scope Standard Entity
 *
 * Links an audit to a standard, defining whether the full standard
 * or selected clauses are in scope.
 * Extends MappingEntityBase for standard mapping fields.
 */
@Entity('grc_audit_scope_standards')
@Index(['tenantId', 'auditId', 'standardId'], { unique: true })
@Index(['tenantId', 'auditId'])
@Index(['tenantId', 'standardId'])
export class AuditScopeStandard extends MappingEntityBase {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'audit_id', type: 'uuid' })
  @Index()
  auditId: string;

  @ManyToOne(() => GrcAudit, { nullable: false })
  @JoinColumn({ name: 'audit_id' })
  audit: GrcAudit;

  @Column({ name: 'standard_id', type: 'uuid' })
  @Index()
  standardId: string;

  @ManyToOne(() => Standard, (standard) => standard.auditScopes, { nullable: false })
  @JoinColumn({ name: 'standard_id' })
  standard: Standard;

  @Column({
    name: 'scope_type',
    type: 'varchar',
    length: 20,
    default: ScopeType.FULL,
  })
  scopeType: ScopeType;

  @Column({ name: 'is_locked', type: 'boolean', default: false })
  isLocked: boolean;

  @Column({ name: 'locked_at', type: 'timestamp', nullable: true })
  lockedAt: Date | null;

  @Column({ name: 'locked_by', type: 'uuid', nullable: true })
  lockedBy: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
