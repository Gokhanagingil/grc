import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddRiskTreatmentActions
 *
 * Creates the grc_risk_treatment_actions table for tracking
 * treatment plan actions/tasks associated with risks.
 */
export class AddRiskTreatmentActions1738200000000 implements MigrationInterface {
  name = 'AddRiskTreatmentActions1738200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create treatment action status enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "treatment_action_status_enum" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create grc_risk_treatment_actions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_risk_treatment_actions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "risk_id" uuid NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "status" "treatment_action_status_enum" NOT NULL DEFAULT 'PLANNED',
        "owner_user_id" uuid,
        "owner_display_name" varchar(255),
        "due_date" date,
        "completed_at" timestamptz,
        "progress_pct" integer NOT NULL DEFAULT 0,
        "evidence_link" varchar(1024),
        "sort_order" integer NOT NULL DEFAULT 0,
        "notes" text,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_risk_treatment_actions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_risk_treatment_actions_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_risk_treatment_actions_risk" FOREIGN KEY ("risk_id") REFERENCES "grc_risks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_risk_treatment_actions_owner" FOREIGN KEY ("owner_user_id") REFERENCES "nest_users"("id") ON DELETE SET NULL
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risk_treatment_actions_tenant_id" 
      ON "grc_risk_treatment_actions" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risk_treatment_actions_risk_id" 
      ON "grc_risk_treatment_actions" ("tenant_id", "risk_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risk_treatment_actions_status" 
      ON "grc_risk_treatment_actions" ("tenant_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risk_treatment_actions_owner" 
      ON "grc_risk_treatment_actions" ("tenant_id", "owner_user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risk_treatment_actions_due_date" 
      ON "grc_risk_treatment_actions" ("tenant_id", "due_date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risk_treatment_actions_due_date"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risk_treatment_actions_owner"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risk_treatment_actions_status"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risk_treatment_actions_risk_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risk_treatment_actions_tenant_id"
    `);

    // Drop table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_risk_treatment_actions"
    `);

    // Drop enum
    await queryRunner.query(`
      DROP TYPE IF EXISTS "treatment_action_status_enum"
    `);
  }
}
