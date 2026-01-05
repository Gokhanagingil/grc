import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: CreateGrcRisksTable
 *
 * Creates the grc_risks table required by the GrcRisk entity.
 * This table is fundamental for GRC risk management functionality.
 *
 * This migration runs after RenameTenantsToNestTenants (1735100000000)
 * to ensure the nest_tenants table exists for the foreign key relationship.
 */
export class CreateGrcRisksTable1735200000000 implements MigrationInterface {
  name = 'CreateGrcRisksTable1735200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure uuid extension is available
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    // Create RiskSeverity enum type
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "risk_severity_enum" AS ENUM ('low', 'medium', 'high', 'critical');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create RiskLikelihood enum type
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "risk_likelihood_enum" AS ENUM ('rare', 'unlikely', 'possible', 'likely', 'almost_certain');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create RiskStatus enum type
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "risk_status_enum" AS ENUM ('draft', 'identified', 'assessed', 'mitigating', 'accepted', 'closed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create grc_risks table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_risks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "category" varchar(100),
        "severity" "risk_severity_enum" NOT NULL DEFAULT 'medium',
        "likelihood" "risk_likelihood_enum" NOT NULL DEFAULT 'possible',
        "impact" "risk_severity_enum" NOT NULL DEFAULT 'medium',
        "score" integer,
        "status" "risk_status_enum" NOT NULL DEFAULT 'draft',
        "owner_user_id" uuid,
        "due_date" date,
        "mitigation_plan" text,
        "tags" jsonb,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_risks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_risks_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_risks_owner" FOREIGN KEY ("owner_user_id") REFERENCES "nest_users"("id") ON DELETE SET NULL
      )
    `);

    // Create indexes from BaseEntity (single column)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risks_tenant_id" 
      ON "grc_risks" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risks_created_at" 
      ON "grc_risks" ("created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risks_updated_at" 
      ON "grc_risks" ("updated_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risks_is_deleted" 
      ON "grc_risks" ("is_deleted")
    `);

    // Create composite indexes from GrcRisk entity
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risks_tenant_status" 
      ON "grc_risks" ("tenant_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risks_tenant_severity" 
      ON "grc_risks" ("tenant_id", "severity")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risks_tenant_owner" 
      ON "grc_risks" ("tenant_id", "owner_user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risks_tenant_status_created" 
      ON "grc_risks" ("tenant_id", "status", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop composite indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risks_tenant_status_created"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risks_tenant_owner"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risks_tenant_severity"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risks_tenant_status"
    `);

    // Drop single column indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risks_is_deleted"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risks_updated_at"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risks_created_at"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risks_tenant_id"
    `);

    // Drop grc_risks table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_risks"
    `);

    // Drop enum types
    await queryRunner.query(`
      DROP TYPE IF EXISTS "risk_status_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "risk_likelihood_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "risk_severity_enum"
    `);
  }
}
