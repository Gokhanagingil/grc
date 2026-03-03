import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * AI Suggestions Provider Mode
 * STUB: deterministic output for tests/CI
 * REAL: real AI provider (behind env vars, disabled by default)
 */
export enum AiSuggestionsProviderMode {
  STUB = 'STUB',
  REAL = 'REAL',
}

/**
 * Allowed action types that AI may suggest.
 * This is the server-side policy allowlist.
 */
export const AI_SUGGESTIONS_ALLOWED_ACTION_TYPES = [
  'OPEN_ENTITY',
  'MARK_READ',
  'ASSIGN_TO_ME',
  'SET_DUE_DATE',
  'CREATE_FOLLOWUP_TODO',
] as const;

export type AiSuggestedActionType =
  (typeof AI_SUGGESTIONS_ALLOWED_ACTION_TYPES)[number];

/**
 * Minimal input fields allowed to be sent to AI provider.
 * Enforced server-side (Data Minimization Policy).
 */
export const AI_SUGGESTIONS_ALLOWED_INPUT_FIELDS = [
  'notification.type',
  'notification.severity',
  'notification.dueAt',
  'notification.entityType',
  'snapshot.primaryLabel',
  'snapshot.secondaryLabel',
  'snapshot.keyFields',
] as const;

/**
 * AI Suggestions Policy Entity
 *
 * Per-tenant policy governing AI Suggestions (Notification Advisor).
 * Controls feature flags, allowed actions, data minimization,
 * rate limits, and caching.
 */
@Entity('nest_ai_suggestions_policy')
@Index(['tenantId'], { unique: true })
export class AiSuggestionsPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  // ── Feature Flags ──────────────────────────────────────────────────

  /** Kill switch: if false, AI suggestions are disabled for this tenant */
  @Column({ name: 'ai_suggestions_enabled', type: 'boolean', default: false })
  aiSuggestionsEnabled: boolean;

  /** Provider mode: STUB for tests/CI, REAL for production */
  @Column({
    name: 'provider_mode',
    type: 'varchar',
    length: 10,
    default: AiSuggestionsProviderMode.STUB,
  })
  providerMode: AiSuggestionsProviderMode;

  // ── Policies ───────────────────────────────────────────────────────

  /** P1: Allowed action types AI may suggest (JSON array of strings) */
  @Column({
    name: 'allowed_action_types',
    type: 'jsonb',
    default: JSON.stringify(AI_SUGGESTIONS_ALLOWED_ACTION_TYPES),
  })
  allowedActionTypes: string[];

  /** P2: Allowed input fields for data minimization (JSON array of strings) */
  @Column({
    name: 'allowed_input_fields',
    type: 'jsonb',
    default: JSON.stringify(AI_SUGGESTIONS_ALLOWED_INPUT_FIELDS),
  })
  allowedInputFields: string[];

  /** P3: Human-in-the-loop — always true in v0 (enforced server-side) */
  @Column({
    name: 'requires_confirm',
    type: 'boolean',
    default: true,
  })
  requiresConfirm: boolean;

  // ── Rate Limits ────────────────────────────────────────────────────

  /** Per-user per-minute suggestion rate limit */
  @Column({
    name: 'rate_limit_per_user_per_minute',
    type: 'int',
    default: 3,
  })
  rateLimitPerUserPerMinute: number;

  /** Per-tenant per-day budget (0 = unlimited) */
  @Column({
    name: 'rate_limit_per_tenant_per_day',
    type: 'int',
    default: 0,
  })
  rateLimitPerTenantPerDay: number;

  // ── Caching ────────────────────────────────────────────────────────

  /** TTL in seconds for cached AI advice (default: 600 = 10 minutes) */
  @Column({
    name: 'cache_ttl_seconds',
    type: 'int',
    default: 600,
  })
  cacheTtlSeconds: number;

  // ── Timestamps ─────────────────────────────────────────────────────

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
