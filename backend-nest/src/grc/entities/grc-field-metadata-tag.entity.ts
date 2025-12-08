import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MappingEntityBase } from '../../common/entities';
import { GrcFieldMetadata } from './grc-field-metadata.entity';
import { GrcClassificationTag } from './grc-classification-tag.entity';

/**
 * GRC Field Metadata Tag Entity (M2M Mapping)
 *
 * Maps classification tags to field metadata.
 * Allows multiple tags to be assigned to a single field.
 */
@Entity('grc_field_metadata_tags')
@Index(['tenantId', 'fieldMetadataId', 'classificationTagId'], { unique: true })
@Index(['tenantId', 'fieldMetadataId'])
@Index(['tenantId', 'classificationTagId'])
export class GrcFieldMetadataTag extends MappingEntityBase {
  @Column({ name: 'field_metadata_id', type: 'uuid' })
  fieldMetadataId: string;

  @ManyToOne(() => GrcFieldMetadata, (fm) => fm.fieldMetadataTags, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'field_metadata_id' })
  fieldMetadata: GrcFieldMetadata;

  @Column({ name: 'classification_tag_id', type: 'uuid' })
  classificationTagId: string;

  @ManyToOne(() => GrcClassificationTag, (ct) => ct.fieldMetadataTags, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'classification_tag_id' })
  classificationTag: GrcClassificationTag;
}
