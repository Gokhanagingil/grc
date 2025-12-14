import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';

export enum SuiteType {
  GRC_SUITE = 'GRC_SUITE',
  ITSM_SUITE = 'ITSM_SUITE',
}

@Entity('tenant_active_suite')
@Index(['tenantId', 'suiteType'], { unique: true })
export class TenantActiveSuite extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({
    name: 'suite_type',
    type: 'enum',
    enum: SuiteType,
  })
  suiteType: SuiteType;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'activated_at', type: 'timestamp', nullable: true })
  activatedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
