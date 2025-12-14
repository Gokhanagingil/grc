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

/**
 * Standard Domain Enum
 * Classifies standards by their primary domain
 */
export enum StandardDomain {
  SECURITY = 'security',
  PRIVACY = 'privacy',
  IT_SERVICE = 'itservice',
  QUALITY = 'quality',
  GOVERNANCE = 'governance',
  CONTINUITY = 'continuity',
}

/**
 * Standard Entity
 *
 * Represents a compliance/regulatory standard as a first-class entity.
 * Examples: ISO 27001, ISO 22301, COBIT, NIST CSF, SOC 2, GDPR
 * Extends BaseEntity for standard audit fields.
 */
@Entity('grc_standards')
@Index(['tenantId', 'code', 'version'], { unique: true })
@Index(['tenantId', 'isActive', 'isDeleted'])
@Index(['tenantId', 'domain'])
export class Standard extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'short_name', type: 'varchar', length: 100, nullable: true })
  shortName: string | null;

  @Column({ type: 'varchar', length: 50 })
  version: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  publisher: string | null;

  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate: Date | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  domain: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany('StandardClause', 'standard')
  clauses: import('./standard-clause.entity').StandardClause[];

  @OneToMany('AuditScopeStandard', 'standard')
  auditScopes: import('./audit-scope-standard.entity').AuditScopeStandard[];
}
