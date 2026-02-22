import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CMDB Class Inheritance — Phase A
 *
 * Adds columns to cmdb_ci_class to support:
 * 1. is_abstract: marks classes that cannot have direct CI instances (only children can)
 * 2. fields_schema: JSONB array of field definitions local to this class
 *
 * The parent_class_id column already exists from the original schema.
 * This migration adds the new columns with safe defaults for backward compatibility.
 */
export class CmdbClassInheritance1741700000000 implements MigrationInterface {
  name = 'CmdbClassInheritance1741700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add is_abstract column with default false (all existing classes remain concrete)
    await queryRunner.query(`
      ALTER TABLE cmdb_ci_class
      ADD COLUMN IF NOT EXISTS is_abstract boolean NOT NULL DEFAULT false
    `);

    // Add fields_schema JSONB column (nullable, existing classes have no local fields defined)
    await queryRunner.query(`
      ALTER TABLE cmdb_ci_class
      ADD COLUMN IF NOT EXISTS fields_schema jsonb DEFAULT NULL
    `);

    // Add index on parent_class_id for efficient tree queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cmdb_ci_class_tenant_parent"
      ON cmdb_ci_class (tenant_id, parent_class_id)
      WHERE is_deleted = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_cmdb_ci_class_tenant_parent"
    `);

    await queryRunner.query(`
      ALTER TABLE cmdb_ci_class DROP COLUMN IF EXISTS fields_schema
    `);

    await queryRunner.query(`
      ALTER TABLE cmdb_ci_class DROP COLUMN IF EXISTS is_abstract
    `);
  }
}
