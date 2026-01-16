import { MigrationInterface, QueryRunner } from 'typeorm';

export class TestResultSprintEnhancements1737000000000 implements MigrationInterface {
  name = 'TestResultSprintEnhancements1737000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types for TestResult method and status
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."grc_test_results_method_enum" AS ENUM('INTERVIEW', 'OBSERVATION', 'INSPECTION', 'REPERFORMANCE', 'OTHER');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."grc_test_results_status_enum" AS ENUM('DRAFT', 'FINAL');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add new columns to grc_test_results table
    await queryRunner.query(`
      ALTER TABLE "grc_test_results" 
      ADD COLUMN IF NOT EXISTS "control_id" uuid,
      ADD COLUMN IF NOT EXISTS "test_date" date,
      ADD COLUMN IF NOT EXISTS "method" "public"."grc_test_results_method_enum" DEFAULT 'OTHER',
      ADD COLUMN IF NOT EXISTS "status" "public"."grc_test_results_status_enum" DEFAULT 'DRAFT',
      ADD COLUMN IF NOT EXISTS "summary" text,
      ADD COLUMN IF NOT EXISTS "owner_user_id" uuid
    `);

    // Create indexes for new columns
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_test_results_tenant_control" ON "grc_test_results" ("tenant_id", "control_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_test_results_tenant_test_date" ON "grc_test_results" ("tenant_id", "test_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_test_results_tenant_status" ON "grc_test_results" ("tenant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_test_results_tenant_method" ON "grc_test_results" ("tenant_id", "method")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_test_results_tenant_updated" ON "grc_test_results" ("tenant_id", "updated_at")`,
    );

    // Add foreign key constraints for new columns
    await queryRunner.query(`
      ALTER TABLE "grc_test_results" 
      ADD CONSTRAINT "FK_grc_test_results_control" FOREIGN KEY ("control_id") REFERENCES "grc_controls"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "grc_test_results" 
      ADD CONSTRAINT "FK_grc_test_results_owner" FOREIGN KEY ("owner_user_id") REFERENCES "nest_users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "grc_test_results" DROP CONSTRAINT IF EXISTS "FK_grc_test_results_owner"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grc_test_results" DROP CONSTRAINT IF EXISTS "FK_grc_test_results_control"`,
    );

    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_test_results_tenant_updated"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_test_results_tenant_method"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_test_results_tenant_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_test_results_tenant_test_date"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_test_results_tenant_control"`,
    );

    // Drop new columns from grc_test_results table
    await queryRunner.query(`
      ALTER TABLE "grc_test_results" 
      DROP COLUMN IF EXISTS "owner_user_id",
      DROP COLUMN IF EXISTS "summary",
      DROP COLUMN IF EXISTS "status",
      DROP COLUMN IF EXISTS "method",
      DROP COLUMN IF EXISTS "test_date",
      DROP COLUMN IF EXISTS "control_id"
    `);

    // Drop enum types
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."grc_test_results_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."grc_test_results_method_enum"`,
    );
  }
}
