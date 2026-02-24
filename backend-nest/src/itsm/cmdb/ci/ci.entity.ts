import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';
import { CmdbCiClass } from '../ci-class/ci-class.entity';

@Entity('cmdb_ci')
@Index(['tenantId', 'name'])
@Index(['tenantId', 'classId'])
@Index(['tenantId', 'lifecycle'])
@Index(['tenantId', 'environment'])
@Index(['tenantId', 'createdAt'])
export class CmdbCi extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  @ManyToOne(() => CmdbCiClass, { nullable: false })
  @JoinColumn({ name: 'class_id' })
  ciClass: CmdbCiClass;

  @Column({ type: 'varchar', length: 50, default: 'installed' })
  lifecycle: string;

  @Column({ type: 'varchar', length: 50, default: 'production' })
  environment: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ name: 'asset_tag', type: 'varchar', length: 100, nullable: true })
  assetTag: string | null;

  @Column({
    name: 'serial_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  serialNumber: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'dns_name', type: 'varchar', length: 255, nullable: true })
  dnsName: string | null;

  @Column({ name: 'managed_by', type: 'uuid', nullable: true })
  managedBy: string | null;

  @Column({ name: 'owned_by', type: 'uuid', nullable: true })
  ownedBy: string | null;

  @Column({ type: 'jsonb', nullable: true })
  attributes: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
