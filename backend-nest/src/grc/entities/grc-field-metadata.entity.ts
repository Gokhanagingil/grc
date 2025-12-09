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
import { GrcFieldMetadataTag } from './grc-field-metadata-tag.entity';

/**
 * GRC Field Metadata Entity
 *
 * Represents metadata about database fields/columns.
 * Used for data classification and governance purposes.
 * Can be tagged with classification tags (privacy, security, compliance).
 */
@Entity('grc_field_metadata')
@Index(['tenantId', 'tableName', 'fieldName'], { unique: true })
@Index(['tenantId', 'tableName'])
export class GrcFieldMetadata extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'table_name', type: 'varchar', length: 255 })
  tableName: string;

  @Column({ name: 'field_name', type: 'varchar', length: 255 })
  fieldName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  label: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'data_type', type: 'varchar', length: 100, nullable: true })
  dataType: string | null;

  @Column({ name: 'is_sensitive', type: 'boolean', default: false })
  isSensitive: boolean;

  @Column({ name: 'is_pii', type: 'boolean', default: false })
  isPii: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => GrcFieldMetadataTag, (fmt) => fmt.fieldMetadata)
  fieldMetadataTags: GrcFieldMetadataTag[];
}
