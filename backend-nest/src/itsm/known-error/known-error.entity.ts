import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { KnownErrorState, KnownErrorFixStatus } from '../enums';

/**
 * Known Error Entity
 *
 * Represents a documented known error in the ITSM problem management process.
 * A Known Error is created when the root cause of a problem is identified and
 * a workaround is documented, but a permanent fix is not yet deployed.
 *
 * Design rationale: Separate table (vs boolean flag on Problem) for:
 * - Independent lifecycle management (DRAFT → PUBLISHED → RETIRED)
 * - Future Knowledge Base integration (articleRef)
 * - Clean audit trail per known error
 * - Multiple known errors can reference the same problem
 * - Rich symptom/workaround documentation
 */
@Entity('itsm_known_errors')
@Index(['tenantId', 'problemId'])
@Index(['tenantId', 'state'])
@Index(['tenantId', 'permanentFixStatus'])
@Index(['tenantId', 'createdAt'])
export class ItsmKnownError extends BaseEntity {
  @Column({ name: 'title', type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'symptoms', type: 'text', nullable: true })
  symptoms: string | null;

  @Column({ name: 'root_cause', type: 'text', nullable: true })
  rootCause: string | null;

  @Column({ name: 'workaround', type: 'text', nullable: true })
  workaround: string | null;

  @Column({
    name: 'permanent_fix_status',
    type: 'enum',
    enum: KnownErrorFixStatus,
    enumName: 'itsm_known_error_fix_status_enum',
    default: KnownErrorFixStatus.NONE,
  })
  permanentFixStatus: KnownErrorFixStatus;

  @Column({ name: 'article_ref', type: 'varchar', length: 255, nullable: true })
  articleRef: string | null;

  @Column({
    name: 'state',
    type: 'enum',
    enum: KnownErrorState,
    enumName: 'itsm_known_error_state_enum',
    default: KnownErrorState.DRAFT,
  })
  state: KnownErrorState;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'problem_id', type: 'uuid', nullable: true })
  problemId: string | null;

  @Column({ name: 'knowledge_candidate', type: 'boolean', default: false })
  knowledgeCandidate: boolean;

  @Column({
    name: 'knowledge_candidate_payload',
    type: 'jsonb',
    nullable: true,
  })
  knowledgeCandidatePayload: Record<string, unknown> | null;

  @Column({ name: 'retired_at', type: 'timestamptz', nullable: true })
  retiredAt: Date | null;

  @Column({ name: 'validated_at', type: 'timestamptz', nullable: true })
  validatedAt: Date | null;

  @Column({ name: 'validated_by', type: 'uuid', nullable: true })
  validatedBy: string | null;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
