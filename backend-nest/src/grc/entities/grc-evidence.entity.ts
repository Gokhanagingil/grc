import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { User } from '../../users/user.entity';
import { EvidenceType, EvidenceSourceType, EvidenceStatus } from '../enums';
import { GrcIssueEvidence } from './grc-issue-evidence.entity';
import { GrcControlEvidence } from './grc-control-evidence.entity';
import { GrcEvidenceTestResult } from './grc-evidence-test-result.entity';

/**
 * GRC Evidence Entity
 *
 * Represents evidence artifacts (documents, screenshots, logs, etc.)
 * that support compliance, risk assessments, or issue resolution.
 * Part of the Golden Flow: Control -> Evidence -> TestResult -> Issue
 * Extends BaseEntity for standard audit fields.
 */
@Entity('grc_evidence')
@Index(['tenantId', 'type'])
@Index(['tenantId', 'collectedAt'])
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'sourceType'])
@Index(['tenantId', 'updatedAt'])
@Index(['tenantId', 'name'])
@Index(['tenantId', 'dueDate'])
@Index(['tenantId', 'code'], { unique: true, where: 'code IS NOT NULL' })
export class GrcEvidence extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: EvidenceType,
    default: EvidenceType.DOCUMENT,
  })
  type: EvidenceType;

  @Column({
    name: 'source_type',
    type: 'enum',
    enum: EvidenceSourceType,
    default: EvidenceSourceType.MANUAL,
  })
  sourceType: EvidenceSourceType;

  @Column({
    type: 'enum',
    enum: EvidenceStatus,
    default: EvidenceStatus.DRAFT,
  })
  status: EvidenceStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  location: string | null;

  @Column({
    name: 'external_url',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  externalUrl: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  tags: string[] | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  hash: string | null;

  @Column({ name: 'file_size', type: 'int', nullable: true })
  fileSize: number | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 100, nullable: true })
  mimeType: string | null;

  @Column({ name: 'collected_at', type: 'date', nullable: true })
  collectedAt: Date | null;

  @Column({ name: 'collected_by_user_id', type: 'uuid', nullable: true })
  collectedByUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'collected_by_user_id' })
  collectedBy: User | null;

  @Column({ name: 'expires_at', type: 'date', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => GrcIssueEvidence, (ie) => ie.evidence)
  issueEvidence: GrcIssueEvidence[];

  // Golden Flow Phase 1 - Control Evidence relationship
  @OneToMany(() => GrcControlEvidence, (ce) => ce.evidence)
  controlEvidence: GrcControlEvidence[];

  // Golden Flow Sprint 1B - TestResult Evidence relationship
  @OneToMany(() => GrcEvidenceTestResult, (etr) => etr.evidence)
  evidenceTestResults: GrcEvidenceTestResult[];
}
