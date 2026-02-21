import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { KnowledgeCandidateStatus, KnowledgeCandidateSourceType } from './pir.enums';

/**
 * ITSM Knowledge Candidate Entity
 *
 * Represents a structured knowledge article candidate generated
 * from PIR, Known Error, or Problem data.
 */
@Entity('itsm_knowledge_candidates')
@Index(['tenantId', 'sourceType', 'sourceId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'createdAt'])
export class ItsmKnowledgeCandidate extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({
    name: 'source_type',
    type: 'enum',
    enum: KnowledgeCandidateSourceType,
    enumName: 'knowledge_candidate_source_enum',
  })
  sourceType: KnowledgeCandidateSourceType;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId: string;

  @Column({
    type: 'enum',
    enum: KnowledgeCandidateStatus,
    enumName: 'knowledge_candidate_status_enum',
    default: KnowledgeCandidateStatus.DRAFT,
  })
  status: KnowledgeCandidateStatus;

  // === Structured Content ===
  @Column({ type: 'jsonb', nullable: true })
  content: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  synopsis: string | null;

  @Column({ type: 'text', nullable: true })
  resolution: string | null;

  @Column({ name: 'root_cause_summary', type: 'text', nullable: true })
  rootCauseSummary: string | null;

  @Column({ type: 'text', nullable: true })
  workaround: string | null;

  @Column({ type: 'text', nullable: true })
  symptoms: string | null;

  // === Review ===
  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
