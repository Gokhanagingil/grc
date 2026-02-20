import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { MappingEntityBase } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { GrcAudit } from './grc-audit.entity';
import { GrcRequirement } from './grc-requirement.entity';

/**
 * Audit Requirement Status Enum
 * Represents the status of a requirement within an audit scope
 */
export enum AuditRequirementStatus {
  PLANNED = 'planned',
  IN_SCOPE = 'in_scope',
  SAMPLED = 'sampled',
  TESTED = 'tested',
  COMPLETED = 'completed',
}

/**
 * GRC Audit-Requirement Mapping Entity
 *
 * Many-to-many relationship between Audits and Requirements.
 * Represents the scope of an audit - which requirements are being audited.
 * An audit can include multiple requirements in its scope.
 * A requirement can be audited in multiple audits.
 * Extends MappingEntityBase for standard mapping fields.
 */
@Entity('grc_audit_requirements')
@Index(['tenantId', 'auditId', 'requirementId'], { unique: true })
export class GrcAuditRequirement extends MappingEntityBase {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'audit_id', type: 'uuid' })
  @Index()
  auditId: string;

  @ManyToOne(() => GrcAudit, (audit) => audit.auditRequirements, {
    nullable: false,
  })
  @JoinColumn({ name: 'audit_id' })
  audit: GrcAudit;

  @Column({ name: 'requirement_id', type: 'uuid' })
  @Index()
  requirementId: string;

  @ManyToOne(
    () => GrcRequirement,
    (requirement) => requirement.auditRequirements,
    {
      nullable: false,
    },
  )
  @JoinColumn({ name: 'requirement_id' })
  requirement: GrcRequirement;

  @Column({
    type: 'enum',
    enum: AuditRequirementStatus,
    default: AuditRequirementStatus.PLANNED,
    nullable: true,
  })
  status: AuditRequirementStatus | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
