import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AI Suggestions Policy — Schema
 *
 * Creates table for per-tenant AI Suggestions (Notification Advisor) governance:
 * - Feature flags (kill switch, provider mode)
 * - Allowed action types & input fields (data minimization)
 * - Human-in-the-loop enforcement
 * - Rate limits (per-user/min, per-tenant/day)
 * - Cache TTL
 */
export class CreateAiSuggestionsPolicyTable1743700000000
  implements MigrationInterface
{
  name = 'CreateAiSuggestionsPolicyTable1743700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "nest_ai_suggestions_policy" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "ai_suggestions_enabled" boolean NOT NULL DEFAULT false,
        "provider_mode" varchar(10) NOT NULL DEFAULT 'STUB',
        "allowed_action_types" jsonb NOT NULL DEFAULT '["OPEN_ENTITY","MARK_READ","ASSIGN_TO_ME","SET_DUE_DATE","CREATE_FOLLOWUP_TODO"]',
        "allowed_input_fields" jsonb NOT NULL DEFAULT '["notification.type","notification.severity","notification.dueAt","notification.entityType","snapshot.primaryLabel","snapshot.secondaryLabel","snapshot.keyFields"]',
        "requires_confirm" boolean NOT NULL DEFAULT true,
        "rate_limit_per_user_per_minute" int NOT NULL DEFAULT 3,
        "rate_limit_per_tenant_per_day" int NOT NULL DEFAULT 0,
        "cache_ttl_seconds" int NOT NULL DEFAULT 600,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_nest_ai_suggestions_policy" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_ai_suggestions_policy_tenant" UNIQUE ("tenant_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ai_suggestions_policy_tenant"
        ON "nest_ai_suggestions_policy" ("tenant_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_suggestions_policy_tenant"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "nest_ai_suggestions_policy"`,
    );
  }
}
