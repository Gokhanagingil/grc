import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { User } from '../../users/user.entity';
import { GrcControl } from './grc-control.entity';
import { ControlTestType, ControlTestStatus } from '../enums';

/**
 * GRC Control Test Entity
 *
 * Represents a scheduled or executed test of a control's effectiveness.
 * Part of the Golden Flow: Control -> ControlTest -> TestResult -> Finding
 * Extends BaseEntity for standard audit fields.
 */
@Entity('grc_control_tests')
@Index(['tenantId', 'controlId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'scheduledDate'])
@Index(['tenantId', 'code'], { unique: true, where: 'code IS NOT NULL' })
@Index(['tenantId', 'status', 'createdAt'])
export class GrcControlTest extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @Column({ name: 'control_id', type: 'uuid' })
  controlId: string;

  @ManyToOne(() => GrcControl, { nullable: false })
  @JoinColumn({ name: 'control_id' })
  control: GrcControl;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'test_type',
    type: 'enum',
    enum: ControlTestType,
    default: ControlTestType.MANUAL,
  })
  testType: ControlTestType;

  @Column({
    type: 'enum',
    enum: ControlTestStatus,
    default: ControlTestStatus.PLANNED,
  })
  status: ControlTestStatus;

  @Column({ name: 'scheduled_date', type: 'date', nullable: true })
  scheduledDate: Date | null;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'tester_user_id', type: 'uuid', nullable: true })
  testerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'tester_user_id' })
  tester: User | null;

  @Column({ name: 'reviewer_user_id', type: 'uuid', nullable: true })
  reviewerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewer_user_id' })
  reviewer: User | null;

  @Column({ name: 'test_procedure', type: 'text', nullable: true })
  testProcedure: string | null;

  @Column({ name: 'sample_size', type: 'int', nullable: true })
  sampleSize: number | null;

  @Column({ name: 'population_size', type: 'int', nullable: true })
  populationSize: number | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
