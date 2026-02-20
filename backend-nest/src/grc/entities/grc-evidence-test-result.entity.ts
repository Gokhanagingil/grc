import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { MappingEntityBase } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { GrcEvidence } from './grc-evidence.entity';
import { GrcTestResult } from './grc-test-result.entity';

/**
 * GRC Evidence-TestResult Mapping Entity
 *
 * Many-to-many relationship between Evidence and TestResults.
 * An evidence artifact can support multiple test results.
 * A test result can have multiple evidence artifacts.
 * Part of the Golden Flow: Control -> Evidence -> TestResult -> Issue
 * Extends MappingEntityBase for standard mapping fields.
 */
@Entity('grc_evidence_test_results')
@Index(['tenantId', 'evidenceId', 'testResultId'], { unique: true })
@Index(['tenantId', 'evidenceId'])
@Index(['tenantId', 'testResultId'])
export class GrcEvidenceTestResult extends MappingEntityBase {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'evidence_id', type: 'uuid' })
  evidenceId: string;

  @ManyToOne(() => GrcEvidence, (evidence) => evidence.evidenceTestResults, {
    nullable: false,
  })
  @JoinColumn({ name: 'evidence_id' })
  evidence: GrcEvidence;

  @Column({ name: 'test_result_id', type: 'uuid' })
  testResultId: string;

  @ManyToOne(() => GrcTestResult, { nullable: false })
  @JoinColumn({ name: 'test_result_id' })
  testResult: GrcTestResult;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
