import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to fix Issue.source column schema drift on staging.
 *
 * This migration is fully idempotent and safe to run multiple times.
 * It ensures the grc_issues.source column exists with proper enum type,
 * NOT NULL constraint, and default value.
 *
 * Root cause: The previous migration (1737100000000-AddIssueSourceField)
 * may not have been run on staging, or was partially applied.
 */
export class FixIssueSourceColumn1737200000000 implements MigrationInterface {
  name = 'FixIssueSourceColumn1737200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Create enum type if it doesn't exist
    // Uses DO block with exception handling for idempotency
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'grc_issues_source_enum') THEN
          CREATE TYPE "public"."grc_issues_source_enum" AS ENUM('manual', 'test_result');
        END IF;
      END $$;
    `);

    // Step 2: Add source column if it doesn't exist
    // Uses information_schema check for idempotency
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'grc_issues' 
          AND column_name = 'source'
        ) THEN
          ALTER TABLE "public"."grc_issues" 
          ADD COLUMN "source" "public"."grc_issues_source_enum" DEFAULT 'manual';
        END IF;
      END $$;
    `);

    // Step 3: Backfill existing rows with 'manual' where source is NULL
    // This is safe to run multiple times (no-op if no NULL values)
    await queryRunner.query(`
      UPDATE "public"."grc_issues" 
      SET "source" = 'manual' 
      WHERE "source" IS NULL
    `);

    // Step 4: Set NOT NULL constraint if not already set
    // Uses information_schema check for idempotency
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'grc_issues' 
          AND column_name = 'source'
          AND is_nullable = 'YES'
        ) THEN
          ALTER TABLE "public"."grc_issues" 
          ALTER COLUMN "source" SET NOT NULL;
        END IF;
      END $$;
    `);

    // Step 5: Set default value (idempotent - PostgreSQL allows re-setting defaults)
    await queryRunner.query(`
      ALTER TABLE "public"."grc_issues" 
      ALTER COLUMN "source" SET DEFAULT 'manual'
    `);

    // Step 6: Create index for tenant + source queries if it doesn't exist
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_issues_tenant_source" 
      ON "public"."grc_issues" ("tenant_id", "source")
    `);

    // Step 7: Create index for tenant + test_result_id queries if it doesn't exist
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_issues_tenant_test_result" 
      ON "public"."grc_issues" ("tenant_id", "test_result_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: Down migration is intentionally minimal to avoid data loss
    // We only drop the indexes, not the column or enum type

    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."IDX_grc_issues_tenant_test_result"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."IDX_grc_issues_tenant_source"
    `);

    // Remove NOT NULL constraint (make nullable again)
    await queryRunner.query(`
      ALTER TABLE "public"."grc_issues" 
      ALTER COLUMN "source" DROP NOT NULL
    `);

    // Remove default
    await queryRunner.query(`
      ALTER TABLE "public"."grc_issues" 
      ALTER COLUMN "source" DROP DEFAULT
    `);
  }
}
