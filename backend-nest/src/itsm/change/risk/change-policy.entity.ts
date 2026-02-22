import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';

export interface PolicyConditions {
  changeType?: string[];
  riskLevelMin?: string;
  hasFreezeConflict?: boolean;
  minLeadTimeHours?: number;
  riskScoreMin?: number;
  riskScoreMax?: number;
  /** Trigger when customer risk aggregate score >= this value (0-100) */
  customerRiskScoreMin?: number;
  /** Trigger when customer risk aggregate label >= this level */
  customerRiskLabelMin?: string;
  /** Trigger when topology risk score >= this value (0-100) */
  topologyRiskScoreMin?: number;
  /** Trigger when topology blast radius is considered high (totalImpactedNodes >= threshold) */
  topologyHighBlastRadius?: boolean;
  /** Trigger when topology fragility signals count >= this value */
  topologyFragilitySignalsMin?: number;
  /** Trigger when a critical dependency is touched (critical CI in impact graph) */
  topologyCriticalDependencyTouched?: boolean;
  /** Trigger when a single point of failure risk is detected */
  topologySinglePointOfFailureRisk?: boolean;
}

export interface PolicyActions {
  requireCABApproval?: boolean;
  minLeadTimeHours?: number;
  blockDuringFreeze?: boolean;
  requireRiskBelowLevelForAutoApprove?: string;
  autoApproveIfRiskBelow?: number;
  notifyRoles?: string[];
  /** Require implementation plan when triggered */
  requireImplementationPlan?: boolean;
  /** Require backout plan when triggered */
  requireBackoutPlan?: boolean;
  /** Require justification when triggered */
  requireJustification?: boolean;
  /** Require test evidence when triggered (topology-driven) */
  requireTestEvidence?: boolean;
  /** Require stakeholder communication when triggered (topology-driven) */
  requireStakeholderComms?: boolean;
  /** Require maintenance window scheduling when triggered (topology-driven) */
  requireMaintenanceWindow?: boolean;
}

@Entity('itsm_change_policy')
@Index(['tenantId', 'isActive'])
@Index(['tenantId', 'priority'])
export class ChangePolicy extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'jsonb', default: '{}' })
  conditions: PolicyConditions;

  @Column({ type: 'jsonb', default: '{}' })
  actions: PolicyActions;
}
