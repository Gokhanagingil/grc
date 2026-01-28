import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add Source Fields to Issue and CAPA
 *
 * Adds origin/source tracking fields to grc_issues and grc_capas tables:
 * - source_type: Type of source (e.g., SOA_ITEM)
 * - source_id: UUID of the source entity
 * - source_ref: Reference string (e.g., clause code)
 * - source_meta: JSONB for additional metadata
 *
 * Also adds 'soa_item' to the issue_source enum.
 */
export class AddSourceFieldsToIssueAndCapa1737600000000 implements MigrationInterface {
  name = 'AddSourceFieldsToIssueAndCapa1737600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "grc_issues_source_enum" ADD VALUE IF NOT EXISTS 'soa_item'
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_issues"
      ADD COLUMN IF NOT EXISTS "source_type" varchar(50),
      ADD COLUMN IF NOT EXISTS "source_id" uuid,
      ADD COLUMN IF NOT EXISTS "source_ref" varchar(255),
      ADD COLUMN IF NOT EXISTS "source_meta" jsonb
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_issues_source_id" ON "grc_issues" ("source_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_issues_source_type" ON "grc_issues" ("source_type")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_issues_tenant_source" ON "grc_issues" ("tenant_id", "source_type", "source_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_capas"
      ADD COLUMN IF NOT EXISTS "source_type" varchar(50),
      ADD COLUMN IF NOT EXISTS "source_id" uuid,
      ADD COLUMN IF NOT EXISTS "source_ref" varchar(255),
      ADD COLUMN IF NOT EXISTS "source_meta" jsonb
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_capas_source_id" ON "grc_capas" ("source_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_capas_source_type" ON "grc_capas" ("source_type")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_capas_tenant_source" ON "grc_capas" ("tenant_id", "source_type", "source_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_capas_tenant_source"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_grc_capas_source_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_grc_capas_source_id"`);

    await queryRunner.query(`
      ALTER TABLE "grc_capas"
      DROP COLUMN IF EXISTS "source_meta",
      DROP COLUMN IF EXISTS "source_ref",
      DROP COLUMN IF EXISTS "source_id",
      DROP COLUMN IF EXISTS "source_type"
    `);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_issues_tenant_source"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_issues_source_type"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_grc_issues_source_id"`);

    await queryRunner.query(`
      ALTER TABLE "grc_issues"
      DROP COLUMN IF EXISTS "source_meta",
      DROP COLUMN IF EXISTS "source_ref",
      DROP COLUMN IF EXISTS "source_id",
      DROP COLUMN IF EXISTS "source_type"
    `);
  }
}
