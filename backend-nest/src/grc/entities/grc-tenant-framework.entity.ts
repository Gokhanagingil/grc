import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';
import { GrcFramework } from './grc-framework.entity';

/**
 * GrcTenantFramework Entity
 *
 * Mapping table that tracks which frameworks are activated for each tenant.
 * This enables tenant-level framework activation/deactivation.
 */
@Entity('grc_tenant_frameworks')
@Index(['tenantId', 'frameworkId'], { unique: true })
@Index(['tenantId'])
@Index(['frameworkId'])
export class GrcTenantFramework {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'framework_id', type: 'uuid' })
  frameworkId: string;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => GrcFramework, (f) => f.tenantFrameworks, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'framework_id' })
  framework: GrcFramework;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
