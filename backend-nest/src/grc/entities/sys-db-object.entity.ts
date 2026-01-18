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
 * SysDbObject Entity
 *
 * Represents a dynamic table definition in the Platform Builder.
 * Admins can create custom tables with this entity, and the actual
 * data is stored in the dynamic_records table as JSONB.
 *
 * Table names must follow the pattern: u_[a-z0-9_]+
 * This ensures user-defined tables are clearly distinguished from system tables.
 */
@Entity('sys_db_object')
@Index(['tenantId', 'name'], { unique: true })
@Index(['tenantId', 'isActive'])
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

  @OneToMany(() => SysDictionary, (field) => field.dbObject)
  fields: SysDictionary[];
}
