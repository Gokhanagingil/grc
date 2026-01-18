import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: CreateGrcControlProcessesTable
 *
 * Creates the grc_control_processes table for the M2M relationship
 * between GRC Controls and Processes. This enables "process-only controls" -
 * controls that are linked to processes without being linked to compliance requirements.
 *
 * This migration is idempotent and safe for existing staging data.
 */
export class CreateGrcControlProcessesTable1736400000000 implements MigrationInterface {
  name = 'CreateGrcControlProcessesTable1736400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the grc_control_processes table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_control_processes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "control_id" uuid NOT NULL,
        "process_id" uuid NOT NULL,
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grc_control_processes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_control_processes_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_control_processes_control" FOREIGN KEY ("control_id") REFERENCES "grc_controls"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_control_processes_process" FOREIGN KEY ("process_id") REFERENCES "grc_processes"("id") ON DELETE CASCADE
      )
    `);

    // Create unique constraint for tenant isolation + uniqueness
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_control_processes_tenant_control_process" 
      ON "grc_control_processes" ("tenant_id", "control_id", "process_id")
    `);

    // Create index on tenant_id for tenant isolation queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_control_processes_tenant_id" 
      ON "grc_control_processes" ("tenant_id")
    `);

    // Create index on control_id for control lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_control_processes_control_id" 
      ON "grc_control_processes" ("control_id")
    `);

    // Create index on process_id for process lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_control_processes_process_id" 
      ON "grc_control_processes" ("process_id")
    `);

    console.log('Created grc_control_processes table with indexes');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_control_processes_process_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_control_processes_control_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_control_processes_tenant_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_control_processes_tenant_control_process"
    `);

    // Drop the table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_control_processes"
    `);

    console.log('Dropped grc_control_processes table and indexes');
  }
}
