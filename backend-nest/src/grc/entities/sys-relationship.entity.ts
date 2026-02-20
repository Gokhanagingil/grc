import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';

export enum SysRelationshipType {
  ONE_TO_ONE = 'one_to_one',
  ONE_TO_MANY = 'one_to_many',
  MANY_TO_MANY = 'many_to_many',
}

@Entity('sys_relationship')
@Index(['tenantId', 'name'], { unique: true })
@Index(['tenantId', 'fromTable'])
@Index(['tenantId', 'toTable'])
export class SysRelationship extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ name: 'from_table', type: 'varchar', length: 100 })
  fromTable: string;

  @Column({ name: 'to_table', type: 'varchar', length: 100 })
  toTable: string;

  @Column({
    type: 'enum',
    enum: SysRelationshipType,
    default: SysRelationshipType.ONE_TO_MANY,
  })
  type: SysRelationshipType;

  @Column({ name: 'fk_column', type: 'varchar', length: 100, nullable: true })
  fkColumn: string | null;

  @Column({ name: 'm2m_table', type: 'varchar', length: 100, nullable: true })
  m2mTable: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
