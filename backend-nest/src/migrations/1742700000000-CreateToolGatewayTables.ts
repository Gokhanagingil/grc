import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tool Gateway v1.1 — Schema
 *
 * Creates tables for:
 * 1. nest_integration_provider_config — External integration provider config (per-tenant)
 * 2. nest_tool_policy — Per-tenant tool governance policy
 *
 * Also extends nest_ai_audit_event with tool-specific columns:
 * - tool_key, provider_key, external_request_id, request_meta
 */
export class CreateToolGatewayTables1742700000000 implements MigrationInterface {
  name = 'CreateToolGatewayTables1742700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Integration Provider Config ─────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "nest_integration_provider_config" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "provider_key" varchar(30) NOT NULL,
        "display_name" varchar(255) NOT NULL,
        "is_enabled" boolean NOT NULL DEFAULT true,
        "base_url" varchar(1024) NOT NULL,
        "auth_type" varchar(30) NOT NULL,
        "username_encrypted" text,
        "password_encrypted" text,
        "token_encrypted" text,
        "custom_headers_encrypted" text,
        "is_deleted" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_nest_integration_provider_config" PRIMARY KEY ("id"),
        CONSTRAINT "FK_integration_provider_config_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_integration_provider_config_tenant"
        ON "nest_integration_provider_config" ("tenant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_integration_provider_config_tenant_key"
        ON "nest_integration_provider_config" ("tenant_id", "provider_key")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_integration_provider_config_tenant_enabled"
        ON "nest_integration_provider_config" ("tenant_id", "is_enabled")
    `);

    // ── 2. Tool Policy ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "nest_tool_policy" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "is_tools_enabled" boolean NOT NULL DEFAULT false,
        "allowed_tools" jsonb NOT NULL DEFAULT '[]',
        "rate_limit_per_minute" int NOT NULL DEFAULT 60,
        "max_tool_calls_per_run" int NOT NULL DEFAULT 10,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_nest_tool_policy" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tool_policy_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_tool_policy_tenant" UNIQUE ("tenant_id")
      )
    `);

    // ── 3. Extend AI Audit Event with tool-specific columns ────────────
    // Add columns only if they don't exist (safe for re-runs)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'nest_ai_audit_event' AND column_name = 'tool_key'
        ) THEN
          ALTER TABLE "nest_ai_audit_event" ADD COLUMN "tool_key" varchar(50);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'nest_ai_audit_event' AND column_name = 'provider_key'
        ) THEN
          ALTER TABLE "nest_ai_audit_event" ADD COLUMN "provider_key" varchar(30);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'nest_ai_audit_event' AND column_name = 'external_request_id'
        ) THEN
          ALTER TABLE "nest_ai_audit_event" ADD COLUMN "external_request_id" varchar(64);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'nest_ai_audit_event' AND column_name = 'request_meta'
        ) THEN
          ALTER TABLE "nest_ai_audit_event" ADD COLUMN "request_meta" jsonb;
        END IF;
      END
      $$;
    `);

    // Index on tool_key for filtering tool audit events
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ai_audit_event_tool_key"
        ON "nest_ai_audit_event" ("tool_key")
        WHERE "tool_key" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_audit_event_tool_key"`,
    );

    // Remove tool-specific columns from audit event
    await queryRunner.query(`
      ALTER TABLE "nest_ai_audit_event"
        DROP COLUMN IF EXISTS "request_meta",
        DROP COLUMN IF EXISTS "external_request_id",
        DROP COLUMN IF EXISTS "provider_key",
        DROP COLUMN IF EXISTS "tool_key"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "nest_tool_policy"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_integration_provider_config_tenant_enabled"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_integration_provider_config_tenant_key"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_integration_provider_config_tenant"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "nest_integration_provider_config"`,
    );
  }
}
