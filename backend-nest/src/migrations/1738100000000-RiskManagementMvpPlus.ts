import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: RiskManagementMvpPlus
 *
 * Upgrades the Risk Management module to MVP+ level with:
 * - New grc_risk_categories table for normalized risk categories
 * - New grc_risk_assessments table for assessment history
 * - Enhanced grc_risks table with inherent/residual scoring, type, appetite, treatment
 * - Enhanced grc_risk_controls table with effectiveness rating enum
 * - New enum types for risk type, appetite, treatment strategy, assessment type, etc.
 */
export class RiskManagementMvpPlus1738100000000 implements MigrationInterface {
  name = 'RiskManagementMvpPlus1738100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create new enum types
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "risk_type_enum" AS ENUM ('strategic', 'operational', 'compliance', 'financial', 'technology', 'cyber', 'third_party', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "risk_appetite_enum" AS ENUM ('low', 'medium', 'high');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "treatment_strategy_enum" AS ENUM ('avoid', 'mitigate', 'transfer', 'accept');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "assessment_type_enum" AS ENUM ('inherent', 'residual');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "control_effectiveness_enum" AS ENUM ('unknown', 'effective', 'partially_effective', 'ineffective');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "risk_band_enum" AS ENUM ('low', 'medium', 'high', 'critical');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add new values to existing risk_status_enum
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "risk_status_enum" ADD VALUE IF NOT EXISTS 'treatment_planned';
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "risk_status_enum" ADD VALUE IF NOT EXISTS 'treating';
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "risk_status_enum" ADD VALUE IF NOT EXISTS 'monitored';
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create grc_risk_categories table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_risk_categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "color" varchar(7),
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_risk_categories" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_risk_categories_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE
      )
    `);

    // Create unique index for category name per tenant
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_risk_categories_tenant_name" 
      ON "grc_risk_categories" ("tenant_id", "name")
      WHERE "is_deleted" = false
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risk_categories_tenant_id" 
      ON "grc_risk_categories" ("tenant_id")
    `);

    // Create grc_risk_assessments table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_risk_assessments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "risk_id" uuid NOT NULL,
        "assessment_type" "assessment_type_enum" NOT NULL DEFAULT 'inherent',
        "likelihood" integer NOT NULL,
        "impact" integer NOT NULL,
        "score" integer NOT NULL,
        "band" "risk_band_enum" NOT NULL DEFAULT 'medium',
        "rationale" text,
        "assessed_at" timestamptz NOT NULL,
        "assessed_by_user_id" uuid,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_risk_assessments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_risk_assessments_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_risk_assessments_risk" FOREIGN KEY ("risk_id") REFERENCES "grc_risks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_risk_assessments_user" FOREIGN KEY ("assessed_by_user_id") REFERENCES "nest_users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risk_assessments_tenant_id" 
      ON "grc_risk_assessments" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risk_assessments_risk_id" 
      ON "grc_risk_assessments" ("risk_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risk_assessments_tenant_risk" 
      ON "grc_risk_assessments" ("tenant_id", "risk_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risk_assessments_tenant_assessed_at" 
      ON "grc_risk_assessments" ("tenant_id", "assessed_at")
    `);

    // Add new columns to grc_risks table
    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      ADD COLUMN IF NOT EXISTS "code" varchar(50)
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      ADD COLUMN IF NOT EXISTS "risk_category_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      ADD COLUMN IF NOT EXISTS "risk_type" "risk_type_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      ADD COLUMN IF NOT EXISTS "inherent_likelihood" integer
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      ADD COLUMN IF NOT EXISTS "inherent_impact" integer
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      ADD COLUMN IF NOT EXISTS "inherent_score" integer
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      ADD COLUMN IF NOT EXISTS "inherent_band" "risk_band_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      ADD COLUMN IF NOT EXISTS "residual_likelihood" integer
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      ADD COLUMN IF NOT EXISTS "residual_impact" integer
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      ADD COLUMN IF NOT EXISTS "residual_score" integer
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      ADD COLUMN IF NOT EXISTS "residual_band" "risk_band_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      ADD COLUMN IF NOT EXISTS "risk_appetite" "risk_appetite_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      ADD COLUMN IF NOT EXISTS "treatment_strategy" "treatment_strategy_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      ADD COLUMN IF NOT EXISTS "treatment_plan" text
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      ADD COLUMN IF NOT EXISTS "owner_display_name" varchar(255)
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      ADD COLUMN IF NOT EXISTS "target_date" date
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      ADD COLUMN IF NOT EXISTS "last_reviewed_at" timestamptz
    `);

    // Add foreign key for risk_category_id
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "grc_risks" 
        ADD CONSTRAINT "FK_grc_risks_category" 
        FOREIGN KEY ("risk_category_id") REFERENCES "grc_risk_categories"("id") ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create new indexes for grc_risks
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_risks_tenant_code" 
      ON "grc_risks" ("tenant_id", "code")
      WHERE "code" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risks_tenant_category" 
      ON "grc_risks" ("tenant_id", "risk_category_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risks_tenant_type" 
      ON "grc_risks" ("tenant_id", "risk_type")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risks_tenant_inherent_score" 
      ON "grc_risks" ("tenant_id", "inherent_score")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risks_tenant_residual_score" 
      ON "grc_risks" ("tenant_id", "residual_score")
    `);

    // Add effectiveness_rating column to grc_risk_controls
    await queryRunner.query(`
      ALTER TABLE "grc_risk_controls" 
      ADD COLUMN IF NOT EXISTS "effectiveness_rating" "control_effectiveness_enum" NOT NULL DEFAULT 'unknown'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove effectiveness_rating from grc_risk_controls
    await queryRunner.query(`
      ALTER TABLE "grc_risk_controls" 
      DROP COLUMN IF EXISTS "effectiveness_rating"
    `);

    // Drop new indexes from grc_risks
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risks_tenant_residual_score"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risks_tenant_inherent_score"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risks_tenant_type"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risks_tenant_category"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risks_tenant_code"
    `);

    // Drop foreign key for risk_category_id
    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      DROP CONSTRAINT IF EXISTS "FK_grc_risks_category"
    `);

    // Remove new columns from grc_risks
    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      DROP COLUMN IF EXISTS "last_reviewed_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      DROP COLUMN IF EXISTS "target_date"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      DROP COLUMN IF EXISTS "owner_display_name"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      DROP COLUMN IF EXISTS "treatment_plan"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      DROP COLUMN IF EXISTS "treatment_strategy"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      DROP COLUMN IF EXISTS "risk_appetite"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      DROP COLUMN IF EXISTS "residual_band"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      DROP COLUMN IF EXISTS "residual_score"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      DROP COLUMN IF EXISTS "residual_impact"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      DROP COLUMN IF EXISTS "residual_likelihood"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      DROP COLUMN IF EXISTS "inherent_band"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      DROP COLUMN IF EXISTS "inherent_score"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      DROP COLUMN IF EXISTS "inherent_impact"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      DROP COLUMN IF EXISTS "inherent_likelihood"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      DROP COLUMN IF EXISTS "risk_type"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      DROP COLUMN IF EXISTS "risk_category_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      DROP COLUMN IF EXISTS "code"
    `);

    // Drop grc_risk_assessments indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risk_assessments_tenant_assessed_at"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risk_assessments_tenant_risk"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risk_assessments_risk_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risk_assessments_tenant_id"
    `);

    // Drop grc_risk_assessments table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_risk_assessments"
    `);

    // Drop grc_risk_categories indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risk_categories_tenant_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risk_categories_tenant_name"
    `);

    // Drop grc_risk_categories table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_risk_categories"
    `);

    // Drop enum types
    await queryRunner.query(`
      DROP TYPE IF EXISTS "risk_band_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "control_effectiveness_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "assessment_type_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "treatment_strategy_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "risk_appetite_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "risk_type_enum"
    `);
  }
}
