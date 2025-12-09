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
import { ClassificationTagType } from '../enums';
import { GrcFieldMetadataTag } from './grc-field-metadata-tag.entity';

/**
 * GRC Classification Tag Entity
 *
 * Represents a classification tag that can be applied to field metadata.
 * Tags are categorized by type: privacy, security, or compliance.
 * Examples: "Personal Data", "Sensitive Personal Data", "Confidential", "Critical Asset Identifier"
 */
@Entity('grc_classification_tags')
@Index(['tenantId', 'tagName'], { unique: true })
@Index(['tenantId', 'tagType'])
export class GrcClassificationTag extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'tag_name', type: 'varchar', length: 255 })
  tagName: string;

  @Column({
    name: 'tag_type',
    type: 'enum',
    enum: ClassificationTagType,
  })
  tagType: ClassificationTagType;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string | null;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => GrcFieldMetadataTag, (fmt) => fmt.classificationTag)
  fieldMetadataTags: GrcFieldMetadataTag[];
}
