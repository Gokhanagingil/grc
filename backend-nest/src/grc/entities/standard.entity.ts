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
import { StandardClause } from './standard-clause.entity';
import { AuditScopeStandard } from './audit-scope-standard.entity';

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
 * Represents a compliance standard (e.g., ISO/IEC 27001:2022).
 * Represents a compliance/regulatory standard as a first-class entity.
 * Examples: ISO 27001, ISO 22301, COBIT, NIST CSF, SOC 2, GDPR
 * Standards contain clauses organized in a hierarchical structure.
 * Extends BaseEntity for standard audit fields.
 */
@Entity('standards')
@Index(['tenantId', 'code'], { unique: true })
@Index(['tenantId', 'domain'])
@Index(['tenantId', 'code', 'version'], { unique: true })
@Index(['tenantId', 'isActive', 'isDeleted'])
export class Standard extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 100 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'short_name', type: 'varchar', length: 100, nullable: true })
  shortName: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  version: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  publisher: string | null;

  @Column({ name: 'published_date', type: 'date', nullable: true })
  publishedDate: Date | null;

  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate: Date | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  domain: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => StandardClause, (clause) => clause.standard)
  clauses: StandardClause[];

  @OneToMany(() => AuditScopeStandard, (ass) => ass.standard)
  auditScopes: AuditScopeStandard[];
}
