import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * AI Action Type Enum
 */
export enum AiActionType {
  TEST_CONNECTION = 'TEST_CONNECTION',
  ANALYZE = 'ANALYZE',
  DRAFT_CREATE = 'DRAFT_CREATE',
  CONFIG_CHANGE = 'CONFIG_CHANGE',
  POLICY_CHANGE = 'POLICY_CHANGE',
  OTHER = 'OTHER',
}

/**
 * AI Audit Status Enum
 */
export enum AiAuditStatus {
  SUCCESS = 'SUCCESS',
  FAIL = 'FAIL',
  SKIPPED = 'SKIPPED',
}

/**
 * AI Audit Event Entity
 *
 * Stores audit trail for AI-related actions.
 * Only safe metadata is stored in v1 — no full prompts or responses.
 */
@Entity('nest_ai_audit_event')
@Index(['tenantId', 'featureKey', 'createdAt'])
@Index(['tenantId', 'createdAt'])
export class AiAuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'feature_key', type: 'varchar', length: 50 })
  featureKey: string;

  @Column({ name: 'provider_type', type: 'varchar', length: 30 })
  providerType: string;

  @Column({ name: 'model_name', type: 'varchar', length: 255, nullable: true })
  modelName: string | null;

  @Column({ name: 'action_type', type: 'varchar', length: 30 })
  actionType: AiActionType;

  @Column({ type: 'varchar', length: 20 })
  status: AiAuditStatus;

  @Column({ name: 'latency_ms', type: 'int', nullable: true })
  latencyMs: number | null;

  @Column({ name: 'tokens_in', type: 'int', nullable: true })
  tokensIn: number | null;

  @Column({ name: 'tokens_out', type: 'int', nullable: true })
  tokensOut: number | null;

  @Column({ name: 'request_hash', type: 'varchar', length: 64, nullable: true })
  requestHash: string | null;

  @Column({
    name: 'response_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  responseHash: string | null;

  @Column({ type: 'text', nullable: true })
  details: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
