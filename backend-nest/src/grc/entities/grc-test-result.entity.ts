import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { User } from '../../users/user.entity';
import { GrcControlTest } from './grc-control-test.entity';
import { GrcControl } from './grc-control.entity';
import {
  TestResultOutcome,
  EffectivenessRating,
  TestMethod,
  TestResultStatus,
} from '../enums';
import { GrcEvidenceTestResult } from './grc-evidence-test-result.entity';

/**
 * GRC Test Result Entity
 *
 * Represents the result of a control test execution.
 * Each ControlTest has exactly one TestResult (1:1 relationship).
 * Part of the Golden Flow: Control -> ControlTest -> TestResult -> Finding
 * Extends BaseEntity for standard audit fields.
 *
 * Test/Result Sprint additions:
 * - Direct controlId for easier querying
 * - testDate, method, status, summary, ownerUserId fields
 */
@Entity('grc_test_results')
@Index(['tenantId', 'controlTestId'], { unique: true })
@Index(['tenantId', 'result'])
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'controlId'])
@Index(['tenantId', 'testDate'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'method'])
@Index(['tenantId', 'updatedAt'])
@Index(['tenantId', 'code'], { unique: true, where: 'code IS NOT NULL' })
export class GrcTestResult extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @Column({ name: 'control_test_id', type: 'uuid', nullable: true })
  controlTestId: string | null;

  @OneToOne(() => GrcControlTest, { nullable: true })
  @JoinColumn({ name: 'control_test_id' })
  controlTest: GrcControlTest | null;

  // Test/Result Sprint - Direct control reference for easier querying
  @Column({ name: 'control_id', type: 'uuid', nullable: true })
  controlId: string | null;

  @ManyToOne(() => GrcControl, { nullable: true })
  @JoinColumn({ name: 'control_id' })
  control: GrcControl | null;

  // Test/Result Sprint - Test date
  @Column({ name: 'test_date', type: 'date', nullable: true })
  testDate: Date | null;

  // Test/Result Sprint - Test method
  @Column({
    type: 'enum',
    enum: TestMethod,
    default: TestMethod.OTHER,
    nullable: true,
  })
  method: TestMethod | null;

  // Test/Result Sprint - Status (draft/final)
  @Column({
    type: 'enum',
    enum: TestResultStatus,
    default: TestResultStatus.DRAFT,
    nullable: true,
  })
  status: TestResultStatus | null;

  // Test/Result Sprint - Summary text
  @Column({ type: 'text', nullable: true })
  summary: string | null;

  // Test/Result Sprint - Owner user
  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;

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

  // Golden Flow Sprint 1B - Evidence relationship
  @OneToMany(() => GrcEvidenceTestResult, (etr) => etr.testResult)
  evidenceTestResults: GrcEvidenceTestResult[];
}
