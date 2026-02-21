import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { CmdbService } from '../cmdb/service/cmdb-service.entity';
import { CmdbServiceOffering } from '../cmdb/service-offering/cmdb-service-offering.entity';
import {
  ProblemState,
  ProblemPriority,
  ProblemImpact,
  ProblemUrgency,
  ProblemCategory,
  ProblemSource,
  ProblemRiskLevel,
  RcaEntryType,
} from '../enums';

/**
 * RCA Entry - Structured root cause analysis entry stored in JSONB
 */
export interface RcaEntry {
  type: RcaEntryType;
  content: string;
  order: number;
  createdAt?: string;
  createdBy?: string;
}

/**
 * ITSM Problem Entity
 *
 * Represents a problem record following ITIL best practices.
 * Problems track the root cause of one or more incidents.
 * Extends BaseEntity for standard audit fields and soft delete.
 */
@Entity('itsm_problems')
@Index(['tenantId', 'number'], { unique: true })
@Index(['tenantId', 'state'])
@Index(['tenantId', 'priority'])
@Index(['tenantId', 'knownError'])
@Index(['tenantId', 'serviceId'])
@Index(['tenantId', 'offeringId'])
@Index(['tenantId', 'createdAt'])
export class ItsmProblem extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 20 })
  number: string;

  @Column({ name: 'short_description', type: 'varchar', length: 255 })
  shortDescription: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: ProblemCategory,
    enumName: 'itsm_problem_category_enum',
    default: ProblemCategory.OTHER,
  })
  category: ProblemCategory;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  subcategory: string | null;

  @Column({
    type: 'enum',
    enum: ProblemState,
    enumName: 'itsm_problem_state_enum',
    default: ProblemState.NEW,
  })
  state: ProblemState;

  @Column({
    type: 'enum',
    enum: ProblemPriority,
    enumName: 'itsm_problem_priority_enum',
    default: ProblemPriority.P3,
  })
  priority: ProblemPriority;

  @Column({
    type: 'enum',
    enum: ProblemImpact,
    enumName: 'itsm_problem_impact_enum',
    default: ProblemImpact.MEDIUM,
  })
  impact: ProblemImpact;

  @Column({
    type: 'enum',
    enum: ProblemUrgency,
    enumName: 'itsm_problem_urgency_enum',
    default: ProblemUrgency.MEDIUM,
  })
  urgency: ProblemUrgency;

  @Column({
    type: 'enum',
    enum: ProblemSource,
    enumName: 'itsm_problem_source_enum',
    default: ProblemSource.MANUAL,
  })
  source: ProblemSource;

  @Column({ name: 'symptom_summary', type: 'text', nullable: true })
  symptomSummary: string | null;

  @Column({ name: 'workaround_summary', type: 'text', nullable: true })
  workaroundSummary: string | null;

  @Column({ name: 'root_cause_summary', type: 'text', nullable: true })
  rootCauseSummary: string | null;

  @Column({ name: 'known_error', type: 'boolean', default: false })
  knownError: boolean;

  @Column({ name: 'error_condition', type: 'text', nullable: true })
  errorCondition: string | null;

  @Column({
    name: 'assignment_group',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  assignmentGroup: string | null;

  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedTo: string | null;

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

  @Column({ name: 'detected_at', type: 'timestamptz', nullable: true })
  detectedAt: Date | null;

  @Column({ name: 'opened_at', type: 'timestamptz', nullable: true })
  openedAt: Date | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({
    name: 'problem_operational_risk_score',
    type: 'int',
    nullable: true,
  })
  problemOperationalRiskScore: number | null;

  @Column({
    name: 'problem_operational_risk_level',
    type: 'enum',
    enum: ProblemRiskLevel,
    enumName: 'itsm_problem_risk_level_enum',
    nullable: true,
  })
  problemOperationalRiskLevel: ProblemRiskLevel | null;

  @Column({ name: 'rca_entries', type: 'jsonb', nullable: true })
  rcaEntries: RcaEntry[] | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
