import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { GrcTenantFramework } from './grc-tenant-framework.entity';

/**
 * GrcFramework Entity
 *
 * Represents a compliance/regulatory framework that can be activated by tenants.
 * This is a global entity (not tenant-scoped) since frameworks are shared across all tenants.
 * Examples: ISO27001, SOC2, NIST, GDPR
 */
@Entity('grc_frameworks')
@Index(['key'], { unique: true })
export class GrcFramework {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  key: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => GrcTenantFramework, (tf) => tf.framework)
  tenantFrameworks: GrcTenantFramework[];
}
