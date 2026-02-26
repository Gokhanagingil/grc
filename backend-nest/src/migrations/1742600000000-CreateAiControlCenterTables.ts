import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AI Control Center v1 — Schema
 *
 * Creates tables for:
 * 1. nest_ai_provider_config — AI provider configuration (global + per-tenant)
 * 2. nest_ai_feature_policy — Per-tenant AI feature policy
 * 3. nest_ai_audit_event — AI audit trail (metadata only, no prompts)
 */
export class CreateAiControlCenterTables1742600000000 implements MigrationInterface {
  name = 'CreateAiControlCenterTables1742600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. AI Provider Config ───────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "nest_ai_provider_config" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "provider_type" varchar(30) NOT NULL,
        "display_name" varchar(255) NOT NULL,
        "is_enabled" boolean NOT NULL DEFAULT true,
        "base_url" varchar(1024),
        "model_name" varchar(255),
        "request_timeout_ms" int NOT NULL DEFAULT 30000,
        "max_tokens" int,
        "temperature" decimal(3,2),
        "api_key_encrypted" text,
        "custom_headers_encrypted" text,
        "is_deleted" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_nest_ai_provider_config" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_provider_config_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ai_provider_config_tenant"
        ON "nest_ai_provider_config" ("tenant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ai_provider_config_tenant_type"
        ON "nest_ai_provider_config" ("tenant_id", "provider_type")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ai_provider_config_tenant_enabled"
        ON "nest_ai_provider_config" ("tenant_id", "is_enabled")
    `);

    // ── 2. AI Feature Policy ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "nest_ai_feature_policy" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "is_ai_enabled" boolean NOT NULL DEFAULT false,
        "default_provider_config_id" uuid,
        "human_approval_required_default" boolean NOT NULL DEFAULT true,
        "allowed_features" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_nest_ai_feature_policy" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_feature_policy_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_ai_feature_policy_tenant" UNIQUE ("tenant_id")
      )
    `);

    // ── 3. AI Audit Event ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "nest_ai_audit_event" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "user_id" uuid,
        "feature_key" varchar(50) NOT NULL,
        "provider_type" varchar(30) NOT NULL,
        "model_name" varchar(255),
        "action_type" varchar(30) NOT NULL,
        "status" varchar(20) NOT NULL,
        "latency_ms" int,
        "tokens_in" int,
        "tokens_out" int,
        "request_hash" varchar(64),
        "response_hash" varchar(64),
        "details" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_nest_ai_audit_event" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ai_audit_event_tenant"
        ON "nest_ai_audit_event" ("tenant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ai_audit_event_tenant_feature_created"
        ON "nest_ai_audit_event" ("tenant_id", "feature_key", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ai_audit_event_tenant_created"
        ON "nest_ai_audit_event" ("tenant_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_audit_event_tenant_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_audit_event_tenant_feature_created"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ai_audit_event_tenant"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_provider_config_tenant_enabled"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_provider_config_tenant_type"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_provider_config_tenant"`,
    );

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "nest_ai_audit_event"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "nest_ai_feature_policy"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "nest_ai_provider_config"`);
  }
}
