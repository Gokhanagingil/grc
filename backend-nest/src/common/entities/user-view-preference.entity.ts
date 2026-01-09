import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';
import { User } from '../../users/user.entity';
import { ViewPreference } from '../dto/table-schema.dto';

/**
 * User View Preference Entity
 *
 * Stores user-specific view preferences for list pages.
 * Each user can have one preference per table per tenant.
 * Preferences include visible columns, column order, sort, filters, and page size.
 */
@Entity('user_view_preferences')
@Unique(['tenantId', 'userId', 'tableName'])
@Index(['tenantId', 'userId'])
@Index(['tenantId', 'tableName'])
export class UserViewPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'table_name', type: 'varchar', length: 100 })
  tableName: string;

  @Column({ name: 'visible_columns', type: 'jsonb', default: '[]' })
  visibleColumns: string[];

  @Column({ name: 'column_order', type: 'jsonb', default: '[]' })
  columnOrder: string[];

  @Column({ name: 'column_widths', type: 'jsonb', nullable: true })
  columnWidths: Record<string, number> | null;

  @Column({ name: 'sort_field', type: 'varchar', length: 100, nullable: true })
  sortField: string | null;

  @Column({
    name: 'sort_direction',
    type: 'varchar',
    length: 4,
    nullable: true,
  })
  sortDirection: 'ASC' | 'DESC' | null;

  @Column({ name: 'filters', type: 'jsonb', nullable: true })
  filters: Record<string, unknown> | null;

  @Column({ name: 'page_size', type: 'int', nullable: true })
  pageSize: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /**
   * Convert entity to ViewPreference DTO
   */
  toViewPreference(): ViewPreference {
    return {
      visibleColumns: this.visibleColumns || [],
      columnOrder: this.columnOrder || [],
      columnWidths: this.columnWidths || undefined,
      sort:
        this.sortField && this.sortDirection
          ? { field: this.sortField, direction: this.sortDirection }
          : undefined,
      filters: this.filters as Record<string, never> | undefined,
      pageSize: this.pageSize || undefined,
    };
  }
}
