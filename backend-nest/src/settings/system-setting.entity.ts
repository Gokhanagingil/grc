import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * System Setting Entity
 *
 * Stores global system-wide settings that apply to all tenants.
 * These settings can be overridden at the tenant level using TenantSetting.
 */
@Entity('nest_system_settings')
export class SystemSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Unique key for the setting (e.g., 'maxLoginAttempts', 'defaultLocale')
   */
  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  key: string;

  /**
   * Setting value stored as JSON string
   */
  @Column({ type: 'text' })
  value: string;

  /**
   * Human-readable description of the setting
   */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Category for grouping settings (e.g., 'security', 'localization', 'limits')
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
