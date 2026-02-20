import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';

export enum ImportSourceType {
  CSV = 'CSV',
  HTTP = 'HTTP',
  WEBHOOK = 'WEBHOOK',
  JSON = 'JSON',
}

@Entity('cmdb_import_source')
@Index(['tenantId', 'name'])
export class CmdbImportSource extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'enum', enum: ImportSourceType, default: ImportSourceType.JSON })
  type: ImportSourceType;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;
}
