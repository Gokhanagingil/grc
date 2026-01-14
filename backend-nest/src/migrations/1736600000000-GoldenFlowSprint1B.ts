import { MigrationInterface, QueryRunner } from 'typeorm';

export class GoldenFlowSprint1B1736600000000 implements MigrationInterface {
  name = 'GoldenFlowSprint1B1736600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types for Evidence source_type and status
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."grc_evidence_source_type_enum" AS ENUM('MANUAL', 'URL', 'SYSTEM');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."grc_evidence_status_enum" AS ENUM('DRAFT', 'APPROVED', 'RETIRED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add new columns to grc_evidence table
    await queryRunner.query(`
      ALTER TABLE "grc_evidence" 
      ADD COLUMN IF NOT EXISTS "source_type" "public"."grc_evidence_source_type_enum" DEFAULT 'MANUAL',
      ADD COLUMN IF NOT EXISTS "status" "public"."grc_evidence_status_enum" DEFAULT 'DRAFT',
      ADD COLUMN IF NOT EXISTS "external_url" varchar(1000),
      ADD COLUMN IF NOT EXISTS "tags" text[]
    `);

    // Create grc_evidence_test_results join table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_evidence_test_results" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "evidence_id" uuid NOT NULL,
        "test_result_id" uuid NOT NULL,
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grc_evidence_test_results" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for grc_evidence_test_results
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_evidence_test_results_tenant_evidence_test_result" ON "grc_evidence_test_results" ("tenant_id", "evidence_id", "test_result_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_evidence_test_results_tenant_evidence" ON "grc_evidence_test_results" ("tenant_id", "evidence_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_evidence_test_results_tenant_test_result" ON "grc_evidence_test_results" ("tenant_id", "test_result_id")`,
    );

    // Create indexes for new columns on grc_evidence
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_evidence_tenant_status" ON "grc_evidence" ("tenant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_evidence_tenant_source_type" ON "grc_evidence" ("tenant_id", "source_type")`,
    );

    // Add foreign key constraints for grc_evidence_test_results
    await queryRunner.query(`
      ALTER TABLE "grc_evidence_test_results" 
      ADD CONSTRAINT "FK_grc_evidence_test_results_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "grc_evidence_test_results" 
      ADD CONSTRAINT "FK_grc_evidence_test_results_evidence" FOREIGN KEY ("evidence_id") REFERENCES "grc_evidence"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "grc_evidence_test_results" 
      ADD CONSTRAINT "FK_grc_evidence_test_results_test_result" FOREIGN KEY ("test_result_id") REFERENCES "grc_test_results"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints for grc_evidence_test_results
    await queryRunner.query(
      `ALTER TABLE "grc_evidence_test_results" DROP CONSTRAINT IF EXISTS "FK_grc_evidence_test_results_test_result"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grc_evidence_test_results" DROP CONSTRAINT IF EXISTS "FK_grc_evidence_test_results_evidence"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grc_evidence_test_results" DROP CONSTRAINT IF EXISTS "FK_grc_evidence_test_results_tenant"`,
    );

    // Drop indexes for grc_evidence_test_results
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_evidence_test_results_tenant_test_result"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_evidence_test_results_tenant_evidence"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_evidence_test_results_tenant_evidence_test_result"`,
    );

    // Drop indexes for new columns on grc_evidence
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_evidence_tenant_source_type"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_evidence_tenant_status"`,
    );

    // Drop grc_evidence_test_results table
    await queryRunner.query(`DROP TABLE IF EXISTS "grc_evidence_test_results"`);

    // Drop new columns from grc_evidence table
    await queryRunner.query(`
      ALTER TABLE "grc_evidence" 
      DROP COLUMN IF EXISTS "tags",
      DROP COLUMN IF EXISTS "external_url",
      DROP COLUMN IF EXISTS "status",
      DROP COLUMN IF EXISTS "source_type"
    `);

    // Drop enum types (only if not used elsewhere)
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."grc_evidence_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."grc_evidence_source_type_enum"`,
    );
  }
}
