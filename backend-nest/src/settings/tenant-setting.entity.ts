import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';

/**
 * Tenant Setting Entity
 *
 * Stores tenant-specific settings that override system-wide defaults.
 * If a tenant setting exists for a key, it takes precedence over the system setting.
 */
@Entity('nest_tenant_settings')
@Index(['tenantId', 'key'], { unique: true })
export class TenantSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Tenant this setting belongs to
   */
  @Column({ type: 'uuid' })
  @Index()
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  /**
   * Setting key (e.g., 'maxLoginAttempts', 'defaultLocale')
   */
  @Column({ type: 'varchar', length: 255 })
  @Index()
  key: string;

  /**
   * Setting value stored as JSON string
   */
  @Column({ type: 'text' })
  value: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
