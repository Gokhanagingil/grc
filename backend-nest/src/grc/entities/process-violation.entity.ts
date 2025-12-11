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
import { ViolationSeverity, ViolationStatus } from '../enums';
import { ProcessControl } from './process-control.entity';
import { ControlResult } from './control-result.entity';
import { GrcRisk } from './grc-risk.entity';

/**
 * ProcessViolation Entity
 *
 * Represents a violation created when a control result is non-compliant.
 * Violations can be linked to existing GrcRisk records for tracking.
 * Extends BaseEntity for standard audit fields.
 */
@Entity('grc_process_violations')
@Index(['tenantId', 'controlId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'severity'])
@Index(['tenantId', 'linkedRiskId'])
@Index(['tenantId', 'controlResultId'], { unique: true })
export class ProcessViolation extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'control_id', type: 'uuid' })
  controlId: string;

  @ManyToOne(() => ProcessControl, { nullable: false })
  @JoinColumn({ name: 'control_id' })
  control: ProcessControl;

  @Column({ name: 'control_result_id', type: 'uuid' })
  controlResultId: string;

  @OneToOne(() => ControlResult, (result) => result.violation, {
    nullable: false,
  })
  @JoinColumn({ name: 'control_result_id' })
  controlResult: ControlResult;

  @Column({
    type: 'enum',
    enum: ViolationSeverity,
    default: ViolationSeverity.MEDIUM,
  })
  severity: ViolationSeverity;

  @Column({
    type: 'enum',
    enum: ViolationStatus,
    default: ViolationStatus.OPEN,
  })
  status: ViolationStatus;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'linked_risk_id', type: 'uuid', nullable: true })
  linkedRiskId: string | null;

  @ManyToOne(() => GrcRisk, { nullable: true })
  @JoinColumn({ name: 'linked_risk_id' })
  linkedRisk: GrcRisk | null;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string | null;
}
