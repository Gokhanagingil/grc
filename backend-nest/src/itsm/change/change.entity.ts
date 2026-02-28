import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { User } from '../../users/user.entity';
import { CmdbService } from '../cmdb/service/cmdb-service.entity';
import { CmdbServiceOffering } from '../cmdb/service-offering/cmdb-service-offering.entity';
import { CoreCompany } from '../../core-company/core-company.entity';

export enum ChangeType {
  STANDARD = 'STANDARD',
  NORMAL = 'NORMAL',
  EMERGENCY = 'EMERGENCY',
}

export enum ChangeState {
  DRAFT = 'DRAFT',
  ASSESS = 'ASSESS',
  AUTHORIZE = 'AUTHORIZE',
  IMPLEMENT = 'IMPLEMENT',
  REVIEW = 'REVIEW',
  CLOSED = 'CLOSED',
}

export enum ChangeRisk {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum ChangeApprovalStatus {
  NOT_REQUESTED = 'NOT_REQUESTED',
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('itsm_changes')
@Index(['tenantId', 'number'], { unique: true })
@Index(['tenantId', 'state'])
@Index(['tenantId', 'type'])
@Index(['tenantId', 'risk'])
@Index(['tenantId', 'approvalStatus'])
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'serviceId'])
@Index(['tenantId', 'offeringId'])
@Index(['tenantId', 'customerCompanyId'])
export class ItsmChange extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 50 })
  number: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: ChangeType,
    default: ChangeType.NORMAL,
  })
  type: ChangeType;

  @Column({
    type: 'enum',
    enum: ChangeState,
    default: ChangeState.DRAFT,
  })
  state: ChangeState;

  @Column({
    type: 'enum',
    enum: ChangeRisk,
    default: ChangeRisk.MEDIUM,
  })
  risk: ChangeRisk;

  @Column({
    name: 'approval_status',
    type: 'enum',
    enum: ChangeApprovalStatus,
    default: ChangeApprovalStatus.NOT_REQUESTED,
  })
  approvalStatus: ChangeApprovalStatus;

  @Column({ name: 'requester_id', type: 'uuid', nullable: true })
  requesterId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'requester_id' })
  requester: User | null;

  @Column({ name: 'assignee_id', type: 'uuid', nullable: true })
  assigneeId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assignee_id' })
  assignee: User | null;

  @Column({ name: 'service_id', type: 'uuid', nullable: true })
  serviceId: string | null;

  @ManyToOne(() => CmdbService, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'service_id' })
  cmdbService: CmdbService | null;

  @Column({ name: 'offering_id', type: 'uuid', nullable: true })
  offeringId: string | null;

  @ManyToOne(() => CmdbServiceOffering, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'offering_id' })
  offering: CmdbServiceOffering | null;

  @Column({ name: 'planned_start_at', type: 'timestamptz', nullable: true })
  plannedStartAt: Date | null;

  @Column({ name: 'planned_end_at', type: 'timestamptz', nullable: true })
  plannedEndAt: Date | null;

  @Column({ name: 'actual_start_at', type: 'timestamptz', nullable: true })
  actualStartAt: Date | null;

  @Column({ name: 'actual_end_at', type: 'timestamptz', nullable: true })
  actualEndAt: Date | null;

  @Column({ name: 'implementation_plan', type: 'text', nullable: true })
  implementationPlan: string | null;

  @Column({ name: 'backout_plan', type: 'text', nullable: true })
  backoutPlan: string | null;

  @Column({ type: 'text', nullable: true })
  justification: string | null;

  @Column({ name: 'customer_company_id', type: 'uuid', nullable: true })
  customerCompanyId: string | null;

  @ManyToOne(() => CoreCompany, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_company_id' })
  customerCompany: CoreCompany | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
