import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';

/**
 * Analysis Status Enum
 */
export enum AnalysisStatus {
  SUCCESS = 'SUCCESS',
  FAIL = 'FAIL',
  SKIPPED = 'SKIPPED',
}

/**
 * Confidence Level Enum
 */
export enum ConfidenceLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

/**
 * Incident AI Analysis Snapshot Entity
 *
 * Stores AI analysis results linked to an incident in our platform DB.
 * Only safe metadata is stored — no secrets, no full raw tool payloads.
 * Content lengths are bounded to prevent unbounded storage.
 */
@Entity('itsm_incident_ai_analysis')
@Index(['tenantId', 'incidentId', 'createdAt'])
@Index(['tenantId', 'createdAt'])
export class IncidentAiAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'incident_id', type: 'uuid' })
  @Index()
  incidentId: string;

  @Column({ name: 'provider_type', type: 'varchar', length: 30 })
  providerType: string;

  @Column({ name: 'model_name', type: 'varchar', length: 255, nullable: true })
  modelName: string | null;

  @Column({ type: 'varchar', length: 20 })
  status: AnalysisStatus;

  /**
   * Safe input metadata — no secrets, only references and counts
   */
  @Column({ name: 'inputs_meta', type: 'jsonb', nullable: true })
  inputsMeta: {
    incidentRef?: string;
    incidentNumber?: string;
    timeframe?: string;
    toolKeysUsed?: string[];
    toolCallCount?: number;
  } | null;

  /**
   * Safe evidence metadata — only sys_ids and reference counts
   */
  @Column({ name: 'evidence_meta', type: 'jsonb', nullable: true })
  evidenceMeta: {
    serviceNowIncidentSysId?: string;
    relatedCiSysId?: string;
    relatedChangeIds?: string[];
    similarIncidentCount?: number;
  } | null;

  /**
   * Short executive summary — bounded to 2000 chars
   */
  @Column({ name: 'summary_text', type: 'text', nullable: true })
  summaryText: string | null;

  /**
   * Structured recommended actions (triage checklist, next best actions)
   */
  @Column({ name: 'recommended_actions', type: 'jsonb', nullable: true })
  recommendedActions: Array<{
    action: string;
    severity?: string;
    category?: string;
    isDraft?: boolean;
  }> | null;

  /**
   * Customer update draft — bounded to 2000 chars
   */
  @Column({ name: 'customer_update_draft', type: 'text', nullable: true })
  customerUpdateDraft: string | null;

  /**
   * Proposed internal tasks (DRAFT only, never auto-written)
   */
  @Column({ name: 'proposed_tasks', type: 'jsonb', nullable: true })
  proposedTasks: Array<{
    title: string;
    description?: string;
    assignmentGroup?: string;
    priority?: string;
  }> | null;

  /**
   * Similar incidents found (safe excerpts only)
   */
  @Column({ name: 'similar_incidents', type: 'jsonb', nullable: true })
  similarIncidents: Array<{
    id?: string;
    number?: string;
    shortDescription?: string;
    resolutionSummary?: string;
    similarity?: number;
  }> | null;

  /**
   * Impact assessment summary
   */
  @Column({ name: 'impact_assessment', type: 'text', nullable: true })
  impactAssessment: string | null;

  @Column({ type: 'varchar', length: 10 })
  confidence: ConfidenceLevel;

  @Column({ type: 'jsonb', nullable: true })
  assumptions: string[] | null;

  @Column({ name: 'used_data_sources', type: 'jsonb', nullable: true })
  usedDataSources: string[] | null;

  @Column({ name: 'request_hash', type: 'varchar', length: 64, nullable: true })
  requestHash: string | null;

  @Column({
    name: 'response_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  responseHash: string | null;

  @Column({ name: 'error_code', type: 'varchar', length: 50, nullable: true })
  errorCode: string | null;

  @Column({
    name: 'user_safe_error',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  userSafeError: string | null;

  @Column({ name: 'latency_ms', type: 'int', nullable: true })
  latencyMs: number | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
