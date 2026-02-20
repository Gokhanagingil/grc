import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create BCM (Business Continuity Management) Tables
 *
 * Creates the following tables:
 * - bcm_services: Business services for BCM
 * - bcm_bias: Business Impact Analysis records
 * - bcm_plans: Business Continuity/Disaster Recovery plans
 * - bcm_plan_steps: Steps within BCM plans
 * - bcm_exercises: BCM exercises and tests
 *
 * Also creates necessary enums and indexes for performance.
 */
export class CreateBcmTables1738000000000 implements MigrationInterface {
  name = 'CreateBcmTables1738000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums
    await queryRunner.query(`
      CREATE TYPE "bcm_services_status_enum" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED')
    `);

    await queryRunner.query(`
      CREATE TYPE "bcm_criticality_tier_enum" AS ENUM ('TIER_0', 'TIER_1', 'TIER_2', 'TIER_3')
    `);

    await queryRunner.query(`
      CREATE TYPE "bcm_bias_status_enum" AS ENUM ('DRAFT', 'REVIEWED', 'APPROVED')
    `);

    await queryRunner.query(`
      CREATE TYPE "bcm_plans_plan_type_enum" AS ENUM ('BCP', 'DRP', 'IT_CONTINUITY')
    `);

    await queryRunner.query(`
      CREATE TYPE "bcm_plans_status_enum" AS ENUM ('DRAFT', 'APPROVED', 'ACTIVE', 'RETIRED')
    `);

    await queryRunner.query(`
      CREATE TYPE "bcm_plan_steps_status_enum" AS ENUM ('PLANNED', 'READY', 'DEPRECATED')
    `);

    await queryRunner.query(`
      CREATE TYPE "bcm_exercises_exercise_type_enum" AS ENUM ('TABLETOP', 'FAILOVER', 'RESTORE', 'COMMS')
    `);

    await queryRunner.query(`
      CREATE TYPE "bcm_exercises_status_enum" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
    `);

    await queryRunner.query(`
      CREATE TYPE "bcm_exercises_outcome_enum" AS ENUM ('PASS', 'PARTIAL', 'FAIL')
    `);

    // Create bcm_services table
    await queryRunner.query(`
      CREATE TABLE "bcm_services" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "status" "bcm_services_status_enum" NOT NULL DEFAULT 'DRAFT',
        "criticality_tier" "bcm_criticality_tier_enum",
        "business_owner_user_id" uuid,
        "it_owner_user_id" uuid,
        "tags" jsonb,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_bcm_services" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bcm_services_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_bcm_services_business_owner" FOREIGN KEY ("business_owner_user_id") REFERENCES "nest_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_bcm_services_it_owner" FOREIGN KEY ("it_owner_user_id") REFERENCES "nest_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    // Create indexes for bcm_services
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_services_tenant_id" ON "bcm_services" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_services_tenant_status" ON "bcm_services" ("tenant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_services_tenant_criticality" ON "bcm_services" ("tenant_id", "criticality_tier")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_services_tenant_business_owner" ON "bcm_services" ("tenant_id", "business_owner_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_services_tenant_it_owner" ON "bcm_services" ("tenant_id", "it_owner_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_services_tenant_created_at" ON "bcm_services" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_services_is_deleted" ON "bcm_services" ("is_deleted")`,
    );

    // Create bcm_bias table
    await queryRunner.query(`
      CREATE TABLE "bcm_bias" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "service_id" uuid NOT NULL,
        "rto_minutes" int NOT NULL,
        "rpo_minutes" int NOT NULL,
        "mtpd_minutes" int,
        "impact_operational" int NOT NULL DEFAULT 0,
        "impact_financial" int NOT NULL DEFAULT 0,
        "impact_regulatory" int NOT NULL DEFAULT 0,
        "impact_reputational" int NOT NULL DEFAULT 0,
        "overall_impact_score" int,
        "criticality_tier" "bcm_criticality_tier_enum",
        "assumptions" text,
        "dependencies" text,
        "notes" text,
        "status" "bcm_bias_status_enum" NOT NULL DEFAULT 'DRAFT',
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_bcm_bias" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bcm_bias_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_bcm_bias_service" FOREIGN KEY ("service_id") REFERENCES "bcm_services"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // Create indexes for bcm_bias
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_bias_tenant_id" ON "bcm_bias" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_bias_tenant_service" ON "bcm_bias" ("tenant_id", "service_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_bias_tenant_status" ON "bcm_bias" ("tenant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_bias_tenant_criticality" ON "bcm_bias" ("tenant_id", "criticality_tier")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_bias_tenant_created_at" ON "bcm_bias" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_bias_is_deleted" ON "bcm_bias" ("is_deleted")`,
    );

    // Create bcm_plans table
    await queryRunner.query(`
      CREATE TABLE "bcm_plans" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "service_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "plan_type" "bcm_plans_plan_type_enum" NOT NULL DEFAULT 'BCP',
        "status" "bcm_plans_status_enum" NOT NULL DEFAULT 'DRAFT',
        "owner_user_id" uuid,
        "approver_user_id" uuid,
        "approved_at" timestamp,
        "summary" text,
        "triggers" text,
        "recovery_steps" text,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_bcm_plans" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bcm_plans_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_bcm_plans_service" FOREIGN KEY ("service_id") REFERENCES "bcm_services"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_bcm_plans_owner" FOREIGN KEY ("owner_user_id") REFERENCES "nest_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_bcm_plans_approver" FOREIGN KEY ("approver_user_id") REFERENCES "nest_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    // Create indexes for bcm_plans
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_plans_tenant_id" ON "bcm_plans" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_plans_tenant_service" ON "bcm_plans" ("tenant_id", "service_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_plans_tenant_plan_type" ON "bcm_plans" ("tenant_id", "plan_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_plans_tenant_status" ON "bcm_plans" ("tenant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_plans_tenant_owner" ON "bcm_plans" ("tenant_id", "owner_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_plans_tenant_created_at" ON "bcm_plans" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_plans_is_deleted" ON "bcm_plans" ("is_deleted")`,
    );

    // Create bcm_plan_steps table
    await queryRunner.query(`
      CREATE TABLE "bcm_plan_steps" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "plan_id" uuid NOT NULL,
        "step_order" int NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "role_responsible" varchar(255),
        "estimated_minutes" int,
        "status" "bcm_plan_steps_status_enum" NOT NULL DEFAULT 'PLANNED',
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_bcm_plan_steps" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bcm_plan_steps_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_bcm_plan_steps_plan" FOREIGN KEY ("plan_id") REFERENCES "bcm_plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // Create indexes for bcm_plan_steps
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_plan_steps_tenant_id" ON "bcm_plan_steps" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_plan_steps_tenant_plan" ON "bcm_plan_steps" ("tenant_id", "plan_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_plan_steps_tenant_plan_order" ON "bcm_plan_steps" ("tenant_id", "plan_id", "step_order")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_plan_steps_tenant_status" ON "bcm_plan_steps" ("tenant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_plan_steps_tenant_created_at" ON "bcm_plan_steps" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_plan_steps_is_deleted" ON "bcm_plan_steps" ("is_deleted")`,
    );

    // Create bcm_exercises table
    await queryRunner.query(`
      CREATE TABLE "bcm_exercises" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "service_id" uuid NOT NULL,
        "plan_id" uuid,
        "name" varchar(255) NOT NULL,
        "exercise_type" "bcm_exercises_exercise_type_enum" NOT NULL DEFAULT 'TABLETOP',
        "status" "bcm_exercises_status_enum" NOT NULL DEFAULT 'PLANNED',
        "scheduled_at" timestamp,
        "started_at" timestamp,
        "completed_at" timestamp,
        "outcome" "bcm_exercises_outcome_enum",
        "summary" text,
        "lessons_learned" text,
        "linked_issue_id" uuid,
        "linked_capa_id" uuid,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_bcm_exercises" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bcm_exercises_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_bcm_exercises_service" FOREIGN KEY ("service_id") REFERENCES "bcm_services"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_bcm_exercises_plan" FOREIGN KEY ("plan_id") REFERENCES "bcm_plans"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    // Create indexes for bcm_exercises
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_exercises_tenant_id" ON "bcm_exercises" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_exercises_tenant_service" ON "bcm_exercises" ("tenant_id", "service_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_exercises_tenant_plan" ON "bcm_exercises" ("tenant_id", "plan_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_exercises_tenant_exercise_type" ON "bcm_exercises" ("tenant_id", "exercise_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_exercises_tenant_status" ON "bcm_exercises" ("tenant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_exercises_tenant_scheduled_at" ON "bcm_exercises" ("tenant_id", "scheduled_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_exercises_tenant_created_at" ON "bcm_exercises" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcm_exercises_is_deleted" ON "bcm_exercises" ("is_deleted")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order (respecting FK constraints)
    await queryRunner.query(`DROP TABLE IF EXISTS "bcm_exercises"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bcm_plan_steps"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bcm_plans"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bcm_bias"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bcm_services"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "bcm_exercises_outcome_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "bcm_exercises_status_enum"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "bcm_exercises_exercise_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "bcm_plan_steps_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "bcm_plans_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "bcm_plans_plan_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "bcm_bias_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "bcm_criticality_tier_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "bcm_services_status_enum"`);
  }
}
