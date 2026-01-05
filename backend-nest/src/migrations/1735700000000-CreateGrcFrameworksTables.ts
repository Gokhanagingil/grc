import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: CreateGrcFrameworksTables
 *
 * Creates the grc_frameworks and grc_tenant_frameworks tables for tenant-level
 * compliance framework activation.
 *
 * grc_frameworks: Global table of available compliance frameworks (ISO27001, SOC2, etc.)
 * grc_tenant_frameworks: Mapping table tracking which frameworks are activated per tenant
 *
 * This migration is additive only - no existing tables or data are altered.
 */
export class CreateGrcFrameworksTables1735700000000 implements MigrationInterface {
  name = 'CreateGrcFrameworksTables1735700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure uuid extension is available
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    // Create grc_frameworks table (global, not tenant-scoped)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_frameworks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "key" varchar(50) NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grc_frameworks" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_grc_frameworks_key" UNIQUE ("key")
      )
    `);

    // Create index on key for lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_frameworks_key" 
      ON "grc_frameworks" ("key")
    `);

    // Create index on is_active for filtering
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_frameworks_is_active" 
      ON "grc_frameworks" ("is_active")
    `);

    // Create grc_tenant_frameworks table (tenant-scoped mapping)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_tenant_frameworks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "framework_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grc_tenant_frameworks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_tenant_frameworks_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_tenant_frameworks_framework" FOREIGN KEY ("framework_id") REFERENCES "grc_frameworks"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_grc_tenant_frameworks_tenant_framework" UNIQUE ("tenant_id", "framework_id")
      )
    `);

    // Create indexes for grc_tenant_frameworks
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_tenant_frameworks_tenant_id" 
      ON "grc_tenant_frameworks" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_tenant_frameworks_framework_id" 
      ON "grc_tenant_frameworks" ("framework_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes for grc_tenant_frameworks
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_tenant_frameworks_framework_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_tenant_frameworks_tenant_id"
    `);

    // Drop grc_tenant_frameworks table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_tenant_frameworks"
    `);

    // Drop indexes for grc_frameworks
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_frameworks_is_active"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_frameworks_key"
    `);

    // Drop grc_frameworks table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_frameworks"
    `);
  }
}
