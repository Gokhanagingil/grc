import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: CreateGrcRequirementsTable
 *
 * Creates the grc_requirements table required by the GrcRequirement entity.
 * This table is fundamental for GRC compliance requirement management functionality.
 *
 * This migration runs after CreateGrcPoliciesTable (1735300000000)
 * to ensure the nest_tenants and nest_users tables exist for foreign key relationships.
 */
export class CreateGrcRequirementsTable1735400000000 implements MigrationInterface {
  name = 'CreateGrcRequirementsTable1735400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure uuid extension is available
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    // Create ComplianceFramework enum type
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "compliance_framework_enum" AS ENUM ('iso27001', 'soc2', 'gdpr', 'hipaa', 'pci_dss', 'nist', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create grc_requirements table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_requirements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "framework" "compliance_framework_enum" NOT NULL,
        "reference_code" varchar(50) NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "category" varchar(100),
        "priority" varchar(20),
        "status" varchar(50) NOT NULL DEFAULT 'not_started',
        "owner_user_id" uuid,
        "due_date" date,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_requirements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_requirements_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_requirements_owner" FOREIGN KEY ("owner_user_id") REFERENCES "nest_users"("id") ON DELETE SET NULL,
        CONSTRAINT "UQ_grc_requirements_tenant_framework_reference" UNIQUE ("tenant_id", "framework", "reference_code")
      )
    `);

    // Create indexes from BaseEntity (single column)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_requirements_tenant_id" 
      ON "grc_requirements" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_requirements_created_at" 
      ON "grc_requirements" ("created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_requirements_updated_at" 
      ON "grc_requirements" ("updated_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_requirements_is_deleted" 
      ON "grc_requirements" ("is_deleted")
    `);

    // Create composite indexes from GrcRequirement entity
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_requirements_tenant_framework" 
      ON "grc_requirements" ("tenant_id", "framework")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_requirements_tenant_status" 
      ON "grc_requirements" ("tenant_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_requirements_tenant_status_created" 
      ON "grc_requirements" ("tenant_id", "status", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop composite indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_requirements_tenant_status_created"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_requirements_tenant_status"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_requirements_tenant_framework"
    `);

    // Drop single column indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_requirements_is_deleted"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_requirements_updated_at"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_requirements_created_at"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_requirements_tenant_id"
    `);

    // Drop grc_requirements table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_requirements"
    `);

    // Drop enum type
    await queryRunner.query(`
      DROP TYPE IF EXISTS "compliance_framework_enum"
    `);
  }
}
