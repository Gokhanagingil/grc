import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';

export enum SlaMetric {
  RESPONSE_TIME = 'RESPONSE_TIME',
  RESOLUTION_TIME = 'RESOLUTION_TIME',
}

export enum SlaSchedule {
  TWENTY_FOUR_SEVEN = '24X7',
  BUSINESS_HOURS = 'BUSINESS_HOURS',
}

@Entity('itsm_sla_definitions')
@Index(['tenantId', 'name'], { unique: true })
@Index(['tenantId', 'isActive'])
export class SlaDefinition extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: SlaMetric,
    default: SlaMetric.RESOLUTION_TIME,
  })
  metric: SlaMetric;

  @Column({ name: 'target_seconds', type: 'int' })
  targetSeconds: number;

  @Column({
    type: 'enum',
    enum: SlaSchedule,
    default: SlaSchedule.TWENTY_FOUR_SEVEN,
  })
  schedule: SlaSchedule;

  @Column({ name: 'business_start_hour', type: 'int', default: 9 })
  businessStartHour: number;

  @Column({ name: 'business_end_hour', type: 'int', default: 17 })
  businessEndHour: number;

  @Column({ name: 'business_days', type: 'jsonb', default: '[1,2,3,4,5]' })
  businessDays: number[];

  @Column({ name: 'priority_filter', type: 'jsonb', nullable: true })
  priorityFilter: string[] | null;

  @Column({ name: 'service_id_filter', type: 'uuid', nullable: true })
  serviceIdFilter: string | null;

  @Column({
    name: 'stop_on_states',
    type: 'jsonb',
    default: '["resolved","closed"]',
  })
  stopOnStates: string[];

  @Column({
    name: 'pause_on_states',
    type: 'jsonb',
    nullable: true,
  })
  pauseOnStates: string[] | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  order: number;
}
