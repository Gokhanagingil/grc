import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: CreateGrcPoliciesTable
 *
 * Creates the grc_policies table required by the GrcPolicy entity.
 * This table is fundamental for GRC policy management functionality.
 *
 * This migration runs after CreateGrcRisksTable (1735200000000)
 * to ensure the nest_tenants and nest_users tables exist for foreign key relationships.
 */
export class CreateGrcPoliciesTable1735300000000 implements MigrationInterface {
  name = 'CreateGrcPoliciesTable1735300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure uuid extension is available
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    // Create PolicyStatus enum type
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "policy_status_enum" AS ENUM ('draft', 'under_review', 'approved', 'active', 'retired');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create grc_policies table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_policies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "code" varchar(50),
        "version" varchar(20) NOT NULL DEFAULT '1.0',
        "status" "policy_status_enum" NOT NULL DEFAULT 'draft',
        "category" varchar(100),
        "summary" text,
        "content" text,
        "owner_user_id" uuid,
        "effective_date" date,
        "review_date" date,
        "approved_by_user_id" uuid,
        "approved_at" timestamp,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_policies" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_policies_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_policies_owner" FOREIGN KEY ("owner_user_id") REFERENCES "nest_users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_grc_policies_approved_by" FOREIGN KEY ("approved_by_user_id") REFERENCES "nest_users"("id") ON DELETE SET NULL
      )
    `);

    // Create indexes from BaseEntity (single column)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_policies_tenant_id" 
      ON "grc_policies" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_policies_created_at" 
      ON "grc_policies" ("created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_policies_updated_at" 
      ON "grc_policies" ("updated_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_policies_is_deleted" 
      ON "grc_policies" ("is_deleted")
    `);

    // Create composite indexes from GrcPolicy entity
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_policies_tenant_status" 
      ON "grc_policies" ("tenant_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_policies_tenant_category" 
      ON "grc_policies" ("tenant_id", "category")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_policies_tenant_code" 
      ON "grc_policies" ("tenant_id", "code")
      WHERE "code" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_policies_tenant_status_created" 
      ON "grc_policies" ("tenant_id", "status", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop composite indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_policies_tenant_status_created"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_policies_tenant_code"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_policies_tenant_category"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_policies_tenant_status"
    `);

    // Drop single column indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_policies_is_deleted"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_policies_updated_at"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_policies_created_at"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_policies_tenant_id"
    `);

    // Drop grc_policies table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_policies"
    `);

    // Drop enum type
    await queryRunner.query(`
      DROP TYPE IF EXISTS "policy_status_enum"
    `);
  }
}
