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
 * Standard Entity
 *
 * Represents a compliance standard (e.g., ISO/IEC 27001:2022).
 * Standards contain clauses organized in a hierarchical structure.
 * Extends BaseEntity for standard audit fields.
 */
@Entity('standards')
@Index(['tenantId', 'code'], { unique: true })
@Index(['tenantId', 'domain'])
@Index(['tenantId', 'code', 'version'], { unique: true })
export class Standard extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 100 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  version: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  domain: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  publisher: string | null;

  @Column({ name: 'published_date', type: 'date', nullable: true })
  publishedDate: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => StandardClause, (clause) => clause.standard)
  clauses: StandardClause[];

  @OneToMany(() => AuditScopeStandard, (ass) => ass.standard)
  auditScopes: AuditScopeStandard[];
}
