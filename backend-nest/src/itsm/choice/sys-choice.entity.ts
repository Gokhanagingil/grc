import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';

@Entity('sys_choice')
@Unique(['tenantId', 'tableName', 'fieldName', 'value'])
@Index(['tenantId', 'tableName', 'fieldName'])
@Index(['tenantId', 'tableName'])
@Index(['tenantId', 'isActive'])
export class SysChoice extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'table_name', type: 'varchar', length: 100 })
  tableName: string;

  @Column({ name: 'field_name', type: 'varchar', length: 100 })
  fieldName: string;

  @Column({ type: 'varchar', length: 100 })
  value: string;

  @Column({ type: 'varchar', length: 255 })
  label: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({
    name: 'parent_value',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  parentValue: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
