import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';
import { ItsmChange } from '../change.entity';

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface RiskFactor {
  name: string;
  weight: number;
  score: number;
  weightedScore: number;
  evidence: string;
}

@Entity('itsm_change_risk_assessment')
@Index(['tenantId', 'changeId'])
@Index(['tenantId', 'riskLevel'])
@Index(['tenantId', 'riskScore'])
export class RiskAssessment extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'change_id', type: 'uuid' })
  changeId: string;

  @ManyToOne(() => ItsmChange, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'change_id' })
  change: ItsmChange;

  @Column({ name: 'risk_score', type: 'int', default: 0 })
  riskScore: number;

  @Column({
    name: 'risk_level',
    type: 'enum',
    enum: RiskLevel,
    enumName: 'itsm_risk_level_enum',
    default: RiskLevel.LOW,
  })
  riskLevel: RiskLevel;

  @Column({ name: 'computed_at', type: 'timestamptz', default: () => 'NOW()' })
  computedAt: Date;

  @Column({ type: 'jsonb', default: '[]' })
  breakdown: RiskFactor[];

  @Column({ name: 'impacted_ci_count', type: 'int', default: 0 })
  impactedCiCount: number;

  @Column({ name: 'impacted_service_count', type: 'int', default: 0 })
  impactedServiceCount: number;

  @Column({ name: 'has_freeze_conflict', type: 'boolean', default: false })
  hasFreezeConflict: boolean;

  @Column({ name: 'has_sla_risk', type: 'boolean', default: false })
  hasSlaRisk: boolean;
}
