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
import { GrcControlTest } from './grc-control-test.entity';
import { TestResultOutcome, EffectivenessRating } from '../enums';

/**
 * GRC Test Result Entity
 *
 * Represents the result of a control test execution.
 * Each ControlTest has exactly one TestResult (1:1 relationship).
 * Part of the Golden Flow: Control -> ControlTest -> TestResult -> Finding
 * Extends BaseEntity for standard audit fields.
 */
@Entity('grc_test_results')
@Index(['tenantId', 'controlTestId'], { unique: true })
@Index(['tenantId', 'result'])
@Index(['tenantId', 'createdAt'])
export class GrcTestResult extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'control_test_id', type: 'uuid' })
  controlTestId: string;

  @OneToOne(() => GrcControlTest, { nullable: false })
  @JoinColumn({ name: 'control_test_id' })
  controlTest: GrcControlTest;

  @Column({
    type: 'enum',
    enum: TestResultOutcome,
  })
  result: TestResultOutcome;

  @Column({ name: 'result_details', type: 'text', nullable: true })
  resultDetails: string | null;

  @Column({ name: 'exceptions_noted', type: 'text', nullable: true })
  exceptionsNoted: string | null;

  @Column({ name: 'exceptions_count', type: 'int', default: 0 })
  exceptionsCount: number;

  @Column({ name: 'sample_tested', type: 'int', nullable: true })
  sampleTested: number | null;

  @Column({ name: 'sample_passed', type: 'int', nullable: true })
  samplePassed: number | null;

  @Column({
    name: 'effectiveness_rating',
    type: 'enum',
    enum: EffectivenessRating,
    nullable: true,
  })
  effectivenessRating: EffectivenessRating | null;

  @Column({ type: 'text', nullable: true })
  recommendations: string | null;

  @Column({ name: 'evidence_ids', type: 'uuid', array: true, nullable: true })
  evidenceIds: string[] | null;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'reviewed_by_user_id', type: 'uuid', nullable: true })
  reviewedByUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewed_by_user_id' })
  reviewedBy: User | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
