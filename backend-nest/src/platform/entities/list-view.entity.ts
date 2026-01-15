import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';
import { User } from '../../users/user.entity';

/**
 * List View Scope Enum
 * Defines the visibility scope of a list view
 */
export enum ListViewScope {
  USER = 'user',
  ROLE = 'role',
  TENANT = 'tenant',
  SYSTEM = 'system',
}

/**
 * List View Entity
 *
 * Stores named list views for tables.
 * Views can be scoped to user, role, tenant, or system level.
 *
 * Precedence (highest to lowest):
 * 1. User-specific view (scope=user, owner_user_id matches)
 * 2. Role-specific view (scope=role, role_id matches)
 * 3. Tenant-wide view (scope=tenant)
 * 4. System default view (scope=system)
 */
@Entity('nest_list_views')
@Index(['tenantId', 'tableName'])
@Index(['tenantId', 'tableName', 'scope', 'ownerUserId'])
export class ListView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'table_name', type: 'varchar', length: 100 })
  tableName: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({
    name: 'scope',
    type: 'enum',
    enum: ListViewScope,
    default: ListViewScope.USER,
  })
  scope: ListViewScope;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  ownerUser: User | null;

  @Column({ name: 'role_id', type: 'uuid', nullable: true })
  roleId: string | null;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => ListViewColumn, (column) => column.listView, {
    cascade: true,
    eager: true,
  })
  columns: ListViewColumn[];
}

/**
 * List View Column Entity
 *
 * Stores column configuration for a list view.
 * Columns are ordered by order_index and can be hidden/shown.
 */
@Entity('nest_list_view_columns')
@Index(['listViewId', 'orderIndex'])
export class ListViewColumn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'list_view_id', type: 'uuid' })
  @Index()
  listViewId: string;

  @ManyToOne(() => ListView, (view) => view.columns, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'list_view_id' })
  listView: ListView;

  @Column({ name: 'column_name', type: 'varchar', length: 100 })
  columnName: string;

  @Column({ name: 'order_index', type: 'int' })
  orderIndex: number;

  @Column({ name: 'visible', type: 'boolean', default: true })
  visible: boolean;

  @Column({ name: 'width', type: 'int', nullable: true })
  width: number | null;

  @Column({ name: 'pinned', type: 'varchar', length: 10, nullable: true })
  pinned: 'left' | 'right' | null;
}
