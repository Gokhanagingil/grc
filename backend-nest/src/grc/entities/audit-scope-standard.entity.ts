import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { MappingEntityBase } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { GrcAudit } from './grc-audit.entity';
import { Standard } from './standard.entity';

/**
 * Audit Scope Standard Entity
 *
 * Many-to-many relationship between Audits and Standards.
 * Represents which standards are included in an audit's scope.
 * An audit can include multiple standards.
 * A standard can be audited in multiple audits.
 * Extends MappingEntityBase for standard mapping fields.
 */
@Entity('audit_scope_standards')
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

  @ManyToOne(() => Standard, (standard) => standard.auditScopes, {
    nullable: false,
  })
  @JoinColumn({ name: 'standard_id' })
  standard: Standard;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
