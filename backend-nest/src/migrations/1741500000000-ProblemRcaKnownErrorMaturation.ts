import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2: Problem RCA & Known Error Maturation
 *
 * - Adds structured RCA fields to itsm_problems (five_why_summary, contributing_factors,
 *   root_cause_category, detection_gap, monitoring_gap, rca_completed_at/by)
 * - Adds reopen tracking fields to itsm_problems (reopen_count, last_reopen_reason, last_reopened_at)
 * - Adds VALIDATED state to itsm_known_error_state_enum
 * - Adds knowledge candidate fields to itsm_known_errors
 * - Adds lifecycle timestamp fields to itsm_known_errors (retired_at, validated_at/by)
 * - Creates itsm_root_cause_category_enum
 */
export class ProblemRcaKnownErrorMaturation1741500000000 implements MigrationInterface {
  name = 'ProblemRcaKnownErrorMaturation1741500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create root cause category enum
    await queryRunner.query(`
      CREATE TYPE "itsm_root_cause_category_enum" AS ENUM (
        'HUMAN_ERROR',
        'PROCESS_FAILURE',
        'TECHNOLOGY_FAILURE',
        'EXTERNAL_FACTOR',
        'DESIGN_FLAW',
        'CAPACITY_ISSUE',
        'CHANGE_RELATED',
        'CONFIGURATION_ERROR',
        'VENDOR_ISSUE',
        'UNKNOWN'
      );
    `);

    // 2. Add structured RCA fields to itsm_problems
    await queryRunner.query(`
      ALTER TABLE "itsm_problems"
        ADD COLUMN "five_why_summary" text,
        ADD COLUMN "contributing_factors" jsonb,
        ADD COLUMN "root_cause_category" "itsm_root_cause_category_enum",
        ADD COLUMN "detection_gap" text,
        ADD COLUMN "monitoring_gap" text,
        ADD COLUMN "rca_completed_at" timestamptz,
        ADD COLUMN "rca_completed_by" uuid;
    `);

    // 3. Add reopen tracking fields to itsm_problems
    await queryRunner.query(`
      ALTER TABLE "itsm_problems"
        ADD COLUMN "reopen_count" integer NOT NULL DEFAULT 0,
        ADD COLUMN "last_reopen_reason" text,
        ADD COLUMN "last_reopened_at" timestamptz;
    `);

    // 4. Add VALIDATED state to known error state enum (additive only)
    await queryRunner.query(`
      ALTER TYPE "itsm_known_error_state_enum" ADD VALUE IF NOT EXISTS 'VALIDATED' BEFORE 'PUBLISHED';
    `);

    // 5. Add knowledge candidate and lifecycle fields to itsm_known_errors
    await queryRunner.query(`
      ALTER TABLE "itsm_known_errors"
        ADD COLUMN "knowledge_candidate" boolean NOT NULL DEFAULT false,
        ADD COLUMN "knowledge_candidate_payload" jsonb,
        ADD COLUMN "retired_at" timestamptz,
        ADD COLUMN "validated_at" timestamptz,
        ADD COLUMN "validated_by" uuid;
    `);

    // 6. Add index on root_cause_category for filtering
    await queryRunner.query(`
      CREATE INDEX "IDX_itsm_problems_tenant_root_cause_category"
        ON "itsm_problems" ("tenant_id", "root_cause_category")
        WHERE "root_cause_category" IS NOT NULL;
    `);

    // 7. Add index on reopen_count for recurrence analysis
    await queryRunner.query(`
      CREATE INDEX "IDX_itsm_problems_tenant_reopen_count"
        ON "itsm_problems" ("tenant_id", "reopen_count")
        WHERE "reopen_count" > 0;
    `);

    // 8. Add index on knowledge_candidate for filtering
    await queryRunner.query(`
      CREATE INDEX "IDX_itsm_known_errors_tenant_knowledge_candidate"
        ON "itsm_known_errors" ("tenant_id", "knowledge_candidate")
        WHERE "knowledge_candidate" = true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itsm_known_errors_tenant_knowledge_candidate"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itsm_problems_tenant_reopen_count"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itsm_problems_tenant_root_cause_category"`,
    );

    // Remove known error columns
    await queryRunner.query(`
      ALTER TABLE "itsm_known_errors"
        DROP COLUMN IF EXISTS "validated_by",
        DROP COLUMN IF EXISTS "validated_at",
        DROP COLUMN IF EXISTS "retired_at",
        DROP COLUMN IF EXISTS "knowledge_candidate_payload",
        DROP COLUMN IF EXISTS "knowledge_candidate";
    `);

    // Note: Cannot remove enum value 'VALIDATED' from itsm_known_error_state_enum
    // PostgreSQL does not support removing enum values. This is safe as additive.

    // Remove problem reopen fields
    await queryRunner.query(`
      ALTER TABLE "itsm_problems"
        DROP COLUMN IF EXISTS "last_reopened_at",
        DROP COLUMN IF EXISTS "last_reopen_reason",
        DROP COLUMN IF EXISTS "reopen_count";
    `);

    // Remove problem RCA fields
    await queryRunner.query(`
      ALTER TABLE "itsm_problems"
        DROP COLUMN IF EXISTS "rca_completed_by",
        DROP COLUMN IF EXISTS "rca_completed_at",
        DROP COLUMN IF EXISTS "monitoring_gap",
        DROP COLUMN IF EXISTS "detection_gap",
        DROP COLUMN IF EXISTS "root_cause_category",
        DROP COLUMN IF EXISTS "contributing_factors",
        DROP COLUMN IF EXISTS "five_why_summary";
    `);

    // Drop root cause category enum
    await queryRunner.query(
      `DROP TYPE IF EXISTS "itsm_root_cause_category_enum"`,
    );
  }
}
