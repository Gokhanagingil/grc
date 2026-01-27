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
import { GrcSoaItem } from './grc-soa-item.entity';
import { SoaProfileStatus } from '../enums';

/**
 * GRC SOA Profile Entity
 *
 * Represents a Statement of Applicability (SOA) profile for a compliance standard.
 * An SOA profile documents which controls/clauses from a standard are applicable
 * to an organization and their implementation status.
 *
 * Key features:
 * - Links to a specific standard (e.g., ISO 27001:2022)
 * - Contains scope statement for auditors
 * - Supports draft/published/archived lifecycle
 * - Version tracking with publishedAt timestamp
 *
 * Extends BaseEntity for standard audit fields.
 */
@Entity('grc_soa_profiles')
@Index(['tenantId', 'standardId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'name'])
export class GrcSoaProfile extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'standard_id', type: 'uuid' })
  @Index()
  standardId: string;

  @ManyToOne(() => Standard, { nullable: false })
  @JoinColumn({ name: 'standard_id' })
  standard: Standard;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'scope_text', type: 'text', nullable: true })
  scopeText: string | null;

  @Column({
    type: 'enum',
    enum: SoaProfileStatus,
    default: SoaProfileStatus.DRAFT,
  })
  status: SoaProfileStatus;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  @OneToMany(() => GrcSoaItem, (item) => item.profile)
  items: GrcSoaItem[];
}
