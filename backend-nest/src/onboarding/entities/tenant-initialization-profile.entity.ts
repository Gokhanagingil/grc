import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';

@Entity('tenant_initialization_profile')
@Index('idx_tenant_init_profile_tenant_unique', ['tenantId'], { unique: true })
export class TenantInitializationProfile extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'schema_version', type: 'int', default: 1 })
  schemaVersion: number;

  @Column({ name: 'policy_set_version', type: 'varchar', length: 50, nullable: true })
  policySetVersion: string | null;

  @Column({ name: 'initialized_at', type: 'timestamp', nullable: true })
  initializedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
