import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIssueSourceField1737100000000 implements MigrationInterface {
  name = 'AddIssueSourceField1737100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for Issue source
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."grc_issues_source_enum" AS ENUM('manual', 'test_result');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add source column to grc_issues table
    await queryRunner.query(`
      ALTER TABLE "grc_issues" 
      ADD COLUMN IF NOT EXISTS "source" "public"."grc_issues_source_enum" DEFAULT 'manual'
    `);

    // Create index for tenant + source queries
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_issues_tenant_source" ON "grc_issues" ("tenant_id", "source")`,
    );

    // Create index for tenant + test_result_id queries (for nested listing)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_issues_tenant_test_result" ON "grc_issues" ("tenant_id", "test_result_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_issues_tenant_test_result"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_issues_tenant_source"`,
    );

    // Drop source column from grc_issues table
    await queryRunner.query(`
      ALTER TABLE "grc_issues" 
      DROP COLUMN IF EXISTS "source"
    `);

    // Drop enum type
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."grc_issues_source_enum"`,
    );
  }
}
