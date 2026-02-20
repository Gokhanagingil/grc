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
import { SysDictionary } from './sys-dictionary.entity';

/**
 * SysDbObject Entity (sys_table)
 *
 * Represents a dynamic table definition in the Platform Builder v1.
 * Admins can create custom tables with this entity, and the actual
 * data is stored in the dynamic_records table as JSONB.
 *
 * Custom table names must follow the pattern: u_[a-z0-9_]+
 * Core tables (is_core=true) can use any valid identifier.
 */
@Entity('sys_db_object')
@Index(['tenantId', 'name'], { unique: true })
@Index(['tenantId', 'isActive'])
@Index(['isCore'])
export class SysDbObject extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  label: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  extends: string | null;

  @Column({ name: 'is_core', type: 'boolean', default: false })
  isCore: boolean;

  @Column({
    name: 'display_field',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  displayField: string | null;

  @Column({
    name: 'number_prefix',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  numberPrefix: string | null;

  @OneToMany(() => SysDictionary, (field) => field.dbObject)
  fields: SysDictionary[];
}
