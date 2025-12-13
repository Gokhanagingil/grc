import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';

export enum MaturityLevel {
  FOUNDATIONAL = 'foundational',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

@Entity('tenant_maturity_profile')
@Index('idx_tenant_maturity_profile_tenant_unique', ['tenantId'], { unique: true })
export class TenantMaturityProfile extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({
    name: 'maturity_level',
    type: 'enum',
    enum: MaturityLevel,
    default: MaturityLevel.FOUNDATIONAL,
  })
  maturityLevel: MaturityLevel;

  @Column({ name: 'assessed_at', type: 'timestamp', nullable: true })
  assessedAt: Date | null;

  @Column({ name: 'assessed_by', type: 'uuid', nullable: true })
  assessedBy: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
