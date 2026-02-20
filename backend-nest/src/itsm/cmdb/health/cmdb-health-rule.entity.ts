import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';

export enum HealthRuleSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum HealthRuleType {
  MISSING_OWNER = 'MISSING_OWNER',
  STALE_CI = 'STALE_CI',
  NO_RELATIONSHIPS = 'NO_RELATIONSHIPS',
  MISSING_CLASS = 'MISSING_CLASS',
  MISSING_DESCRIPTION = 'MISSING_DESCRIPTION',
  SERVICE_NO_OFFERING = 'SERVICE_NO_OFFERING',
  CUSTOM = 'CUSTOM',
}

export interface HealthRuleCondition {
  type: HealthRuleType;
  params?: Record<string, unknown>;
}

@Entity('cmdb_health_rule')
@Index(['tenantId', 'enabled'])
export class CmdbHealthRule extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20, default: HealthRuleSeverity.MEDIUM })
  severity: HealthRuleSeverity;

  @Column({ type: 'jsonb', default: '{}' })
  condition: HealthRuleCondition;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;
}
