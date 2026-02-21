import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';

export enum MitigationActionType {
  CHANGE_TASK = 'CHANGE_TASK',
  RISK_OBSERVATION = 'RISK_OBSERVATION',
  RISK_ACCEPTANCE = 'RISK_ACCEPTANCE',
  WAIVER_REQUEST = 'WAIVER_REQUEST',
  REMEDIATION = 'REMEDIATION',
}

export enum MitigationActionStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('itsm_change_mitigation_actions')
@Index(['tenantId', 'changeId'])
@Index(['tenantId', 'catalogRiskId'])
export class MitigationAction extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'change_id', type: 'uuid' })
  changeId: string;

  @Column({ name: 'catalog_risk_id', type: 'uuid', nullable: true })
  catalogRiskId: string | null;

  @Column({ name: 'binding_id', type: 'uuid', nullable: true })
  bindingId: string | null;

  @Column({
    name: 'action_type',
    type: 'varchar',
    length: 50,
    default: MitigationActionType.CHANGE_TASK,
  })
  actionType: MitigationActionType;

  @Column({
    type: 'varchar',
    length: 50,
    default: MitigationActionStatus.OPEN,
  })
  status: MitigationActionStatus;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId: string | null;

  @Column({ name: 'due_date', type: 'timestamptz', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;
}
