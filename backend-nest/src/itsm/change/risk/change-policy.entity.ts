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
}

export interface PolicyActions {
  requireCABApproval?: boolean;
  minLeadTimeHours?: number;
  blockDuringFreeze?: boolean;
  requireRiskBelowLevelForAutoApprove?: string;
  autoApproveIfRiskBelow?: number;
  notifyRoles?: string[];
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
