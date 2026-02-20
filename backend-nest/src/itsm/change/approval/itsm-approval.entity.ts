import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';

export enum ApprovalState {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

@Entity('itsm_approval')
@Index(['tenantId', 'recordTable', 'recordId'])
@Index(['tenantId', 'state'])
@Index(['tenantId', 'approverUserId'])
export class ItsmApproval extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'record_table', type: 'varchar', length: 100 })
  recordTable: string;

  @Column({ name: 'record_id', type: 'uuid' })
  recordId: string;

  @Column({
    type: 'enum',
    enum: ApprovalState,
    enumName: 'itsm_approval_state_enum',
    default: ApprovalState.REQUESTED,
  })
  state: ApprovalState;

  @Column({ name: 'approver_user_id', type: 'uuid', nullable: true })
  approverUserId: string | null;

  @Column({
    name: 'approver_role',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  approverRole: string | null;

  @Column({ name: 'requested_by', type: 'uuid' })
  requestedBy: string;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;
}
