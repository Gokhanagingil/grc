import { MigrationInterface, QueryRunner } from 'typeorm';

export class GoldenFlowPhaseOne1736344000000 implements MigrationInterface {
  name = 'GoldenFlowPhaseOne1736344000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types for Golden Flow Phase 1
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."grc_control_tests_test_type_enum" AS ENUM('MANUAL', 'AUTOMATED', 'HYBRID');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."grc_control_tests_status_enum" AS ENUM('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."grc_test_results_result_enum" AS ENUM('PASS', 'FAIL', 'INCONCLUSIVE', 'NOT_APPLICABLE');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."grc_test_results_effectiveness_rating_enum" AS ENUM('EFFECTIVE', 'PARTIALLY_EFFECTIVE', 'INEFFECTIVE');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."grc_capa_tasks_status_enum" AS ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."grc_control_evidence_evidence_type_enum" AS ENUM('BASELINE', 'TEST', 'PERIODIC');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."grc_capas_priority_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create grc_controls_frequency_enum for test_frequency column on grc_controls
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."grc_controls_frequency_enum" AS ENUM('continuous', 'daily', 'weekly', 'monthly', 'quarterly', 'annual');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create grc_control_tests table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_control_tests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "control_id" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "description" text,
        "test_type" "public"."grc_control_tests_test_type_enum" NOT NULL DEFAULT 'MANUAL',
        "status" "public"."grc_control_tests_status_enum" NOT NULL DEFAULT 'PLANNED',
        "scheduled_date" date,
        "started_at" TIMESTAMP,
        "completed_at" TIMESTAMP,
        "tester_user_id" uuid,
        "reviewer_user_id" uuid,
        "test_procedure" text,
        "sample_size" integer,
        "population_size" integer,
        "metadata" jsonb,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_control_tests" PRIMARY KEY ("id")
      )
    `);

    // Create grc_test_results table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_test_results" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "control_test_id" uuid NOT NULL,
        "result" "public"."grc_test_results_result_enum" NOT NULL,
        "result_details" text,
        "exceptions_noted" text,
        "exceptions_count" integer NOT NULL DEFAULT 0,
        "sample_tested" integer,
        "sample_passed" integer,
        "effectiveness_rating" "public"."grc_test_results_effectiveness_rating_enum",
        "recommendations" text,
        "evidence_ids" uuid[],
        "reviewed_at" TIMESTAMP,
        "reviewed_by_user_id" uuid,
        "metadata" jsonb,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_test_results" PRIMARY KEY ("id")
      )
    `);

    // Create grc_capa_tasks table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_capa_tasks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "capa_id" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "description" text,
        "status" "public"."grc_capa_tasks_status_enum" NOT NULL DEFAULT 'PENDING',
        "assignee_user_id" uuid,
        "due_date" date,
        "completed_at" TIMESTAMP,
        "completed_by_user_id" uuid,
        "sequence_order" integer NOT NULL DEFAULT 0,
        "notes" text,
        "metadata" jsonb,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_capa_tasks" PRIMARY KEY ("id")
      )
    `);

    // Create grc_control_evidence table (join table)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_control_evidence" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "control_id" uuid NOT NULL,
        "evidence_id" uuid NOT NULL,
        "evidence_type" "public"."grc_control_evidence_evidence_type_enum",
        "valid_from" date,
        "valid_until" date,
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grc_control_evidence" PRIMARY KEY ("id")
      )
    `);

    // Create grc_status_history table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_status_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "entity_type" character varying(50) NOT NULL,
        "entity_id" uuid NOT NULL,
        "previous_status" character varying(50),
        "new_status" character varying(50) NOT NULL,
        "changed_by_user_id" uuid,
        "change_reason" text,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grc_status_history" PRIMARY KEY ("id")
      )
    `);

    // Add new columns to grc_controls table
    await queryRunner.query(`
      ALTER TABLE "grc_controls" 
      ADD COLUMN IF NOT EXISTS "test_frequency" "public"."grc_controls_frequency_enum",
      ADD COLUMN IF NOT EXISTS "next_test_date" date,
      ADD COLUMN IF NOT EXISTS "last_test_result" "public"."grc_test_results_result_enum",
      ADD COLUMN IF NOT EXISTS "evidence_requirements" text
    `);

    // Add new columns to grc_issues table
    await queryRunner.query(`
      ALTER TABLE "grc_issues" 
      ADD COLUMN IF NOT EXISTS "test_result_id" uuid,
      ADD COLUMN IF NOT EXISTS "closure_notes" text,
      ADD COLUMN IF NOT EXISTS "closed_by_user_id" uuid,
      ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "reopened_count" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "last_reopened_at" TIMESTAMP
    `);

    // Add new columns to grc_capas table
    await queryRunner.query(`
      ALTER TABLE "grc_capas" 
      ADD COLUMN IF NOT EXISTS "title" character varying(255),
      ADD COLUMN IF NOT EXISTS "root_cause_analysis" text,
      ADD COLUMN IF NOT EXISTS "action_plan" text,
      ADD COLUMN IF NOT EXISTS "implementation_notes" text,
      ADD COLUMN IF NOT EXISTS "verification_method" text,
      ADD COLUMN IF NOT EXISTS "verification_evidence_ids" uuid[],
      ADD COLUMN IF NOT EXISTS "verification_notes" text,
      ADD COLUMN IF NOT EXISTS "closure_notes" text,
      ADD COLUMN IF NOT EXISTS "closed_by_user_id" uuid,
      ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "priority" "public"."grc_capas_priority_enum" NOT NULL DEFAULT 'MEDIUM'
    `);

    // Create indexes for grc_control_tests
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_control_tests_tenant_control" ON "grc_control_tests" ("tenant_id", "control_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_control_tests_tenant_status" ON "grc_control_tests" ("tenant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_control_tests_tenant_scheduled" ON "grc_control_tests" ("tenant_id", "scheduled_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_control_tests_tenant_status_created" ON "grc_control_tests" ("tenant_id", "status", "created_at")`,
    );

    // Create indexes for grc_test_results
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_test_results_tenant_control_test" ON "grc_test_results" ("tenant_id", "control_test_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_test_results_tenant_result" ON "grc_test_results" ("tenant_id", "result")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_test_results_tenant_created" ON "grc_test_results" ("tenant_id", "created_at")`,
    );

    // Create indexes for grc_capa_tasks
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_capa_tasks_tenant_capa" ON "grc_capa_tasks" ("tenant_id", "capa_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_capa_tasks_tenant_status" ON "grc_capa_tasks" ("tenant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_capa_tasks_tenant_assignee" ON "grc_capa_tasks" ("tenant_id", "assignee_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_capa_tasks_tenant_due" ON "grc_capa_tasks" ("tenant_id", "due_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_capa_tasks_tenant_status_created" ON "grc_capa_tasks" ("tenant_id", "status", "created_at")`,
    );

    // Create indexes for grc_control_evidence
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_control_evidence_tenant_control_evidence" ON "grc_control_evidence" ("tenant_id", "control_id", "evidence_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_control_evidence_tenant_control" ON "grc_control_evidence" ("tenant_id", "control_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_control_evidence_tenant_evidence" ON "grc_control_evidence" ("tenant_id", "evidence_id")`,
    );

    // Create indexes for grc_status_history
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_status_history_tenant" ON "grc_status_history" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_status_history_tenant_entity" ON "grc_status_history" ("tenant_id", "entity_type", "entity_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_status_history_tenant_created" ON "grc_status_history" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_status_history_tenant_entity_type_created" ON "grc_status_history" ("tenant_id", "entity_type", "created_at")`,
    );

    // Add foreign key constraints for grc_control_tests
    await queryRunner.query(`
      ALTER TABLE "grc_control_tests" 
      ADD CONSTRAINT "FK_grc_control_tests_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "grc_control_tests" 
      ADD CONSTRAINT "FK_grc_control_tests_control" FOREIGN KEY ("control_id") REFERENCES "grc_controls"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "grc_control_tests" 
      ADD CONSTRAINT "FK_grc_control_tests_tester" FOREIGN KEY ("tester_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "grc_control_tests" 
      ADD CONSTRAINT "FK_grc_control_tests_reviewer" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Add foreign key constraints for grc_test_results
    await queryRunner.query(`
      ALTER TABLE "grc_test_results" 
      ADD CONSTRAINT "FK_grc_test_results_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "grc_test_results" 
      ADD CONSTRAINT "FK_grc_test_results_control_test" FOREIGN KEY ("control_test_id") REFERENCES "grc_control_tests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "grc_test_results" 
      ADD CONSTRAINT "FK_grc_test_results_reviewed_by" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Add foreign key constraints for grc_capa_tasks
    await queryRunner.query(`
      ALTER TABLE "grc_capa_tasks" 
      ADD CONSTRAINT "FK_grc_capa_tasks_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "grc_capa_tasks" 
      ADD CONSTRAINT "FK_grc_capa_tasks_capa" FOREIGN KEY ("capa_id") REFERENCES "grc_capas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "grc_capa_tasks" 
      ADD CONSTRAINT "FK_grc_capa_tasks_assignee" FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "grc_capa_tasks" 
      ADD CONSTRAINT "FK_grc_capa_tasks_completed_by" FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Add foreign key constraints for grc_control_evidence
    await queryRunner.query(`
      ALTER TABLE "grc_control_evidence" 
      ADD CONSTRAINT "FK_grc_control_evidence_control" FOREIGN KEY ("control_id") REFERENCES "grc_controls"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "grc_control_evidence" 
      ADD CONSTRAINT "FK_grc_control_evidence_evidence" FOREIGN KEY ("evidence_id") REFERENCES "grc_evidence"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Add foreign key constraints for grc_status_history
    await queryRunner.query(`
      ALTER TABLE "grc_status_history" 
      ADD CONSTRAINT "FK_grc_status_history_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "grc_status_history" 
      ADD CONSTRAINT "FK_grc_status_history_changed_by" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Add foreign key constraints for new columns in grc_issues
    await queryRunner.query(`
      ALTER TABLE "grc_issues" 
      ADD CONSTRAINT "FK_grc_issues_test_result" FOREIGN KEY ("test_result_id") REFERENCES "grc_test_results"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "grc_issues" 
      ADD CONSTRAINT "FK_grc_issues_closed_by" FOREIGN KEY ("closed_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Add foreign key constraints for new columns in grc_capas
    await queryRunner.query(`
      ALTER TABLE "grc_capas" 
      ADD CONSTRAINT "FK_grc_capas_closed_by" FOREIGN KEY ("closed_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints for grc_capas
    await queryRunner.query(
      `ALTER TABLE "grc_capas" DROP CONSTRAINT IF EXISTS "FK_grc_capas_closed_by"`,
    );

    // Drop foreign key constraints for grc_issues
    await queryRunner.query(
      `ALTER TABLE "grc_issues" DROP CONSTRAINT IF EXISTS "FK_grc_issues_closed_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grc_issues" DROP CONSTRAINT IF EXISTS "FK_grc_issues_test_result"`,
    );

    // Drop foreign key constraints for grc_status_history
    await queryRunner.query(
      `ALTER TABLE "grc_status_history" DROP CONSTRAINT IF EXISTS "FK_grc_status_history_changed_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grc_status_history" DROP CONSTRAINT IF EXISTS "FK_grc_status_history_tenant"`,
    );

    // Drop foreign key constraints for grc_control_evidence
    await queryRunner.query(
      `ALTER TABLE "grc_control_evidence" DROP CONSTRAINT IF EXISTS "FK_grc_control_evidence_evidence"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grc_control_evidence" DROP CONSTRAINT IF EXISTS "FK_grc_control_evidence_control"`,
    );

    // Drop foreign key constraints for grc_capa_tasks
    await queryRunner.query(
      `ALTER TABLE "grc_capa_tasks" DROP CONSTRAINT IF EXISTS "FK_grc_capa_tasks_completed_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grc_capa_tasks" DROP CONSTRAINT IF EXISTS "FK_grc_capa_tasks_assignee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grc_capa_tasks" DROP CONSTRAINT IF EXISTS "FK_grc_capa_tasks_capa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grc_capa_tasks" DROP CONSTRAINT IF EXISTS "FK_grc_capa_tasks_tenant"`,
    );

    // Drop foreign key constraints for grc_test_results
    await queryRunner.query(
      `ALTER TABLE "grc_test_results" DROP CONSTRAINT IF EXISTS "FK_grc_test_results_reviewed_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grc_test_results" DROP CONSTRAINT IF EXISTS "FK_grc_test_results_control_test"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grc_test_results" DROP CONSTRAINT IF EXISTS "FK_grc_test_results_tenant"`,
    );

    // Drop foreign key constraints for grc_control_tests
    await queryRunner.query(
      `ALTER TABLE "grc_control_tests" DROP CONSTRAINT IF EXISTS "FK_grc_control_tests_reviewer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grc_control_tests" DROP CONSTRAINT IF EXISTS "FK_grc_control_tests_tester"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grc_control_tests" DROP CONSTRAINT IF EXISTS "FK_grc_control_tests_control"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grc_control_tests" DROP CONSTRAINT IF EXISTS "FK_grc_control_tests_tenant"`,
    );

    // Drop indexes for grc_status_history
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_status_history_tenant_entity_type_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_status_history_tenant_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_status_history_tenant_entity"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_status_history_tenant"`,
    );

    // Drop indexes for grc_control_evidence
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_control_evidence_tenant_evidence"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_control_evidence_tenant_control"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_control_evidence_tenant_control_evidence"`,
    );

    // Drop indexes for grc_capa_tasks
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_capa_tasks_tenant_status_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_capa_tasks_tenant_due"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_capa_tasks_tenant_assignee"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_capa_tasks_tenant_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_capa_tasks_tenant_capa"`,
    );

    // Drop indexes for grc_test_results
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_test_results_tenant_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_test_results_tenant_result"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_test_results_tenant_control_test"`,
    );

    // Drop indexes for grc_control_tests
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_control_tests_tenant_status_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_control_tests_tenant_scheduled"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_control_tests_tenant_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_control_tests_tenant_control"`,
    );

    // Drop columns from grc_capas
    await queryRunner.query(`
      ALTER TABLE "grc_capas" 
      DROP COLUMN IF EXISTS "priority",
      DROP COLUMN IF EXISTS "closed_at",
      DROP COLUMN IF EXISTS "closed_by_user_id",
      DROP COLUMN IF EXISTS "closure_notes",
      DROP COLUMN IF EXISTS "verification_notes",
      DROP COLUMN IF EXISTS "verification_evidence_ids",
      DROP COLUMN IF EXISTS "verification_method",
      DROP COLUMN IF EXISTS "implementation_notes",
      DROP COLUMN IF EXISTS "action_plan",
      DROP COLUMN IF EXISTS "root_cause_analysis",
      DROP COLUMN IF EXISTS "title"
    `);

    // Drop columns from grc_issues
    await queryRunner.query(`
      ALTER TABLE "grc_issues" 
      DROP COLUMN IF EXISTS "last_reopened_at",
      DROP COLUMN IF EXISTS "reopened_count",
      DROP COLUMN IF EXISTS "closed_at",
      DROP COLUMN IF EXISTS "closed_by_user_id",
      DROP COLUMN IF EXISTS "closure_notes",
      DROP COLUMN IF EXISTS "test_result_id"
    `);

    // Drop columns from grc_controls
    await queryRunner.query(`
      ALTER TABLE "grc_controls" 
      DROP COLUMN IF EXISTS "evidence_requirements",
      DROP COLUMN IF EXISTS "last_test_result",
      DROP COLUMN IF EXISTS "next_test_date",
      DROP COLUMN IF EXISTS "test_frequency"
    `);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "grc_status_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "grc_control_evidence"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "grc_capa_tasks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "grc_test_results"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "grc_control_tests"`);

    // Drop enum types
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."grc_controls_frequency_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."grc_capas_priority_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."grc_control_evidence_evidence_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."grc_capa_tasks_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."grc_test_results_effectiveness_rating_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."grc_test_results_result_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."grc_control_tests_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."grc_control_tests_test_type_enum"`,
    );
  }
}
