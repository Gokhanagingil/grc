import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create itsm_incident_ai_analysis table for Incident Copilot v1.
 * Stores AI analysis snapshots linked to incidents.
 * Only safe metadata — no secrets, no full raw payloads.
 */
export class CreateIncidentAiAnalysisTable1742800000000 implements MigrationInterface {
  name = 'CreateIncidentAiAnalysisTable1742800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_incident_ai_analysis" (
        "id" uuid DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL,
        "incident_id" uuid NOT NULL,
        "provider_type" varchar(30) NOT NULL,
        "model_name" varchar(255),
        "status" varchar(20) NOT NULL,
        "inputs_meta" jsonb,
        "evidence_meta" jsonb,
        "summary_text" text,
        "recommended_actions" jsonb,
        "customer_update_draft" text,
        "proposed_tasks" jsonb,
        "similar_incidents" jsonb,
        "impact_assessment" text,
        "confidence" varchar(10) NOT NULL DEFAULT 'MEDIUM',
        "assumptions" jsonb,
        "used_data_sources" jsonb,
        "request_hash" varchar(64),
        "response_hash" varchar(64),
        "error_code" varchar(50),
        "user_safe_error" varchar(500),
        "latency_ms" int,
        "user_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_itsm_incident_ai_analysis" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_incident_ai_analysis_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_itsm_incident_ai_analysis_incident"
          FOREIGN KEY ("incident_id") REFERENCES "itsm_incidents"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_itsm_incident_ai_analysis_tenant_id"
        ON "itsm_incident_ai_analysis" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_itsm_incident_ai_analysis_incident_id"
        ON "itsm_incident_ai_analysis" ("incident_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_itsm_incident_ai_analysis_tenant_incident_created"
        ON "itsm_incident_ai_analysis" ("tenant_id", "incident_id", "created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_itsm_incident_ai_analysis_tenant_created"
        ON "itsm_incident_ai_analysis" ("tenant_id", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itsm_incident_ai_analysis_tenant_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itsm_incident_ai_analysis_tenant_incident_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itsm_incident_ai_analysis_incident_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itsm_incident_ai_analysis_tenant_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_incident_ai_analysis"`);
  }
}
