import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: CreateTenantsTable
 *
 * Creates the tenants table that is required by onboarding and other migrations.
 * This migration must run before any migration that references the tenants table
 * via foreign key constraints.
 *
 * The tenants table is the foundation for multi-tenancy support in the platform.
 */
export class CreateTenantsTable1730000000000 implements MigrationInterface {
  name = 'CreateTenantsTable1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure uuid extension is available
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    // Create tenants table with minimal columns required by FK references
    // All later migrations reference tenants(id) as uuid, so we must match that type
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(255) NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenants" PRIMARY KEY ("id")
      )
    `);

    // Create unique index on name to ensure tenant names are unique
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenants_name_unique" 
      ON "tenants" ("name")
    `);

    // Create index on is_active for filtering active tenants
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tenants_is_active" 
      ON "tenants" ("is_active")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tenants_is_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tenants_name_unique"`);

    // Drop table (safe - will fail if there are FK references, which is expected)
    await queryRunner.query(`DROP TABLE IF EXISTS "tenants"`);
  }
}

