import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';
import { CmdbImportSource } from './cmdb-import-source.entity';
import { ConnectorType } from './connector/connector.types';
import { FieldMappingEntry, TransformDef } from './engine/safe-transforms';

@Entity('cmdb_import_mapping')
@Index(['tenantId', 'sourceId'])
export class CmdbImportMapping extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId: string;

  @ManyToOne(() => CmdbImportSource, { nullable: false })
  @JoinColumn({ name: 'source_id' })
  source: CmdbImportSource;

  @Column({ name: 'target_class_id', type: 'uuid', nullable: true })
  targetClassId: string | null;

  @Column({
    name: 'connector_type',
    type: 'varchar',
    length: 50,
    default: ConnectorType.JSON_ROWS,
  })
  connectorType: ConnectorType;

  @Column({ name: 'field_map', type: 'jsonb', default: '[]' })
  fieldMap: FieldMappingEntry[];

  @Column({ name: 'key_fields', type: 'jsonb', default: '[]' })
  keyFields: string[];

  @Column({ name: 'transforms', type: 'jsonb', default: '[]' })
  transforms: TransformDef[];

  @Column({ name: 'connector_config', type: 'jsonb', default: '{}' })
  connectorConfig: Record<string, unknown>;
}
