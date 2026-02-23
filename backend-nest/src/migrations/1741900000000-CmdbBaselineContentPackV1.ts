import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CMDB Baseline Content Pack v1 — Schema additions
 *
 * Adds `is_system` column to `cmdb_ci_class` to distinguish system-provided
 * baseline classes from customer-created custom classes.
 */
export class CmdbBaselineContentPackV11741900000000 implements MigrationInterface {
  name = 'CmdbBaselineContentPackV11741900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add is_system column to cmdb_ci_class
    await queryRunner.query(`
      ALTER TABLE "cmdb_ci_class"
      ADD COLUMN IF NOT EXISTS "is_system" boolean NOT NULL DEFAULT false
    `);

    // Index for quick filtering of system vs custom classes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cmdb_ci_class_tenant_is_system"
      ON "cmdb_ci_class" ("tenant_id", "is_system")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_cmdb_ci_class_tenant_is_system"
    `);
    await queryRunner.query(`
      ALTER TABLE "cmdb_ci_class"
      DROP COLUMN IF EXISTS "is_system"
    `);
  }
}
