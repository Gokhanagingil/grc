import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';

@Entity('cmdb_ci_class')
@Index(['tenantId', 'name'], { unique: true })
@Index(['tenantId', 'isActive'])
@Index(['tenantId', 'createdAt'])
export class CmdbCiClass extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  label: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon: string | null;

  @Column({ name: 'parent_class_id', type: 'uuid', nullable: true })
  parentClassId: string | null;

  @ManyToOne(() => CmdbCiClass, { nullable: true })
  @JoinColumn({ name: 'parent_class_id' })
  parentClass: CmdbCiClass | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
