import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';

export enum FrameworkType {
  ISO27001 = 'ISO27001',
  SOC2 = 'SOC2',
  GDPR = 'GDPR',
  HIPAA = 'HIPAA',
  NIST = 'NIST',
  PCI_DSS = 'PCI_DSS',
}

@Entity('tenant_active_framework')
@Index(['tenantId', 'frameworkType'], { unique: true })
export class TenantActiveFramework extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({
    name: 'framework_type',
    type: 'enum',
    enum: FrameworkType,
  })
  frameworkType: FrameworkType;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'activated_at', type: 'timestamp', nullable: true })
  activatedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
