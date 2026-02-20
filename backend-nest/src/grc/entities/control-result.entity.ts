import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  OneToOne,
} from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { User } from '../../users/user.entity';
import { ControlResultSource } from '../enums';
import { ProcessControl } from './process-control.entity';
import { ProcessViolation } from './process-violation.entity';

/**
 * ControlResult Entity
 *
 * Records the result of a control execution (manual or automated).
 * Each result indicates whether the control was compliant or not.
 * Non-compliant results automatically trigger ProcessViolation creation.
 * Extends BaseEntity for standard audit fields.
 */
@Entity('grc_control_results')
@Index(['tenantId', 'controlId'])
@Index(['tenantId', 'executionDate'])
@Index(['tenantId', 'isCompliant'])
@Index(['tenantId', 'controlId', 'executionDate'])
export class ControlResult extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'control_id', type: 'uuid' })
  controlId: string;

  @ManyToOne(() => ProcessControl, (control) => control.results, {
    nullable: false,
  })
  @JoinColumn({ name: 'control_id' })
  control: ProcessControl;

  @Column({ name: 'execution_date', type: 'timestamp with time zone' })
  executionDate: Date;

  @Column({ name: 'executor_user_id', type: 'uuid', nullable: true })
  executorUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'executor_user_id' })
  executor: User | null;

  @Column({
    type: 'enum',
    enum: ControlResultSource,
    default: ControlResultSource.MANUAL,
  })
  source: ControlResultSource;

  @Column({ name: 'result_value_boolean', type: 'boolean', nullable: true })
  resultValueBoolean: boolean | null;

  @Column({
    name: 'result_value_number',
    type: 'decimal',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  resultValueNumber: number | null;

  @Column({ name: 'result_value_text', type: 'text', nullable: true })
  resultValueText: string | null;

  @Column({ name: 'is_compliant', type: 'boolean' })
  isCompliant: boolean;

  @Column({
    name: 'evidence_reference',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  evidenceReference: string | null;

  @OneToOne(() => ProcessViolation, (violation) => violation.controlResult)
  violation: ProcessViolation | null;
}
