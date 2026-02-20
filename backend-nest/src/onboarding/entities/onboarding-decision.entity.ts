import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';

export enum DecisionType {
  SUITE_ACTIVATION = 'suite_activation',
  MODULE_ENABLE = 'module_enable',
  MODULE_DISABLE = 'module_disable',
  FRAMEWORK_ACTIVATION = 'framework_activation',
  FRAMEWORK_DEACTIVATION = 'framework_deactivation',
  MATURITY_CHANGE = 'maturity_change',
  POLICY_OVERRIDE = 'policy_override',
}

@Entity('onboarding_decision')
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'decisionType'])
export class OnboardingDecision extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({
    name: 'decision_type',
    type: 'enum',
    enum: DecisionType,
  })
  decisionType: DecisionType;

  @Column({ name: 'decision_key', type: 'varchar', length: 100 })
  decisionKey: string;

  @Column({ name: 'decision_value', type: 'jsonb' })
  decisionValue: Record<string, unknown>;

  @Column({ name: 'previous_value', type: 'jsonb', nullable: true })
  previousValue: Record<string, unknown> | null;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'decided_by', type: 'uuid' })
  decidedBy: string;

  @Column({
    name: 'decided_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  decidedAt: Date;
}
