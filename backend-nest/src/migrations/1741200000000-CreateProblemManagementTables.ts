import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProblemManagementTables1741200000000 implements MigrationInterface {
  name = 'CreateProblemManagementTables1741200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums
    await queryRunner.query(`
      CREATE TYPE "itsm_problem_state_enum" AS ENUM (
        'NEW', 'UNDER_INVESTIGATION', 'KNOWN_ERROR', 'RESOLVED', 'CLOSED'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "itsm_problem_priority_enum" AS ENUM (
        'P1', 'P2', 'P3', 'P4'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "itsm_problem_impact_enum" AS ENUM (
        'LOW', 'MEDIUM', 'HIGH'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "itsm_problem_urgency_enum" AS ENUM (
        'LOW', 'MEDIUM', 'HIGH'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "itsm_problem_category_enum" AS ENUM (
        'HARDWARE', 'SOFTWARE', 'NETWORK', 'SECURITY', 'DATABASE', 'APPLICATION', 'INFRASTRUCTURE', 'OTHER'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "itsm_problem_source_enum" AS ENUM (
        'MANUAL', 'INCIDENT_CLUSTER', 'MONITORING', 'POSTMORTEM', 'PROACTIVE'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "itsm_problem_risk_level_enum" AS ENUM (
        'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "itsm_problem_incident_link_type_enum" AS ENUM (
        'PRIMARY_SYMPTOM', 'RELATED', 'RECURRENCE'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "itsm_problem_change_link_type_enum" AS ENUM (
        'INVESTIGATES', 'WORKAROUND', 'PERMANENT_FIX', 'ROLLBACK_RELATED'
      )
    `);

    // Create itsm_problems table
    await queryRunner.query(`
      CREATE TABLE "itsm_problems" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "number" varchar(20) NOT NULL,
        "short_description" varchar(255) NOT NULL,
        "description" text,
        "category" "itsm_problem_category_enum" NOT NULL DEFAULT 'OTHER',
        "subcategory" varchar(100),
        "state" "itsm_problem_state_enum" NOT NULL DEFAULT 'NEW',
        "priority" "itsm_problem_priority_enum" NOT NULL DEFAULT 'P3',
        "impact" "itsm_problem_impact_enum" NOT NULL DEFAULT 'MEDIUM',
        "urgency" "itsm_problem_urgency_enum" NOT NULL DEFAULT 'MEDIUM',
        "source" "itsm_problem_source_enum" NOT NULL DEFAULT 'MANUAL',
        "symptom_summary" text,
        "workaround_summary" text,
        "root_cause_summary" text,
        "known_error" boolean NOT NULL DEFAULT false,
        "error_condition" text,
        "assignment_group" varchar(100),
        "assigned_to" uuid,
        "service_id" uuid,
        "offering_id" uuid,
        "detected_at" timestamptz,
        "opened_at" timestamptz,
        "resolved_at" timestamptz,
        "closed_at" timestamptz,
        "problem_operational_risk_score" integer,
        "problem_operational_risk_level" "itsm_problem_risk_level_enum",
        "rca_entries" jsonb,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_problems" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_problems_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_itsm_problems_service" FOREIGN KEY ("service_id") REFERENCES "cmdb_services"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_itsm_problems_offering" FOREIGN KEY ("offering_id") REFERENCES "cmdb_service_offerings"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    // Indexes for itsm_problems
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_itsm_problems_tenant_number" ON "itsm_problems" ("tenant_id", "number")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_problems_tenant_state" ON "itsm_problems" ("tenant_id", "state")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_problems_tenant_priority" ON "itsm_problems" ("tenant_id", "priority")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_problems_tenant_known_error" ON "itsm_problems" ("tenant_id", "known_error")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_problems_tenant_service" ON "itsm_problems" ("tenant_id", "service_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_problems_tenant_offering" ON "itsm_problems" ("tenant_id", "offering_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_problems_tenant_created" ON "itsm_problems" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_problems_is_deleted" ON "itsm_problems" ("is_deleted")`,
    );

    // Create itsm_problem_incident link table
    await queryRunner.query(`
      CREATE TABLE "itsm_problem_incident" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "problem_id" uuid NOT NULL,
        "incident_id" uuid NOT NULL,
        "link_type" "itsm_problem_incident_link_type_enum" NOT NULL DEFAULT 'RELATED',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_problem_incident" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_problem_incident_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_itsm_problem_incident_problem" FOREIGN KEY ("problem_id") REFERENCES "itsm_problems"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_itsm_problem_incident_incident" FOREIGN KEY ("incident_id") REFERENCES "itsm_incidents"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_itsm_problem_incident_unique" ON "itsm_problem_incident" ("tenant_id", "problem_id", "incident_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_problem_incident_problem" ON "itsm_problem_incident" ("tenant_id", "problem_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_problem_incident_incident" ON "itsm_problem_incident" ("tenant_id", "incident_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_problem_incident_created" ON "itsm_problem_incident" ("tenant_id", "created_at")`,
    );

    // Create itsm_problem_change link table
    await queryRunner.query(`
      CREATE TABLE "itsm_problem_change" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "problem_id" uuid NOT NULL,
        "change_id" uuid NOT NULL,
        "relation_type" "itsm_problem_change_link_type_enum" NOT NULL DEFAULT 'INVESTIGATES',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_problem_change" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_problem_change_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_itsm_problem_change_problem" FOREIGN KEY ("problem_id") REFERENCES "itsm_problems"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_itsm_problem_change_change" FOREIGN KEY ("change_id") REFERENCES "itsm_changes"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_itsm_problem_change_unique" ON "itsm_problem_change" ("tenant_id", "problem_id", "change_id", "relation_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_problem_change_problem" ON "itsm_problem_change" ("tenant_id", "problem_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_problem_change_change" ON "itsm_problem_change" ("tenant_id", "change_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_problem_change_created" ON "itsm_problem_change" ("tenant_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_problem_change"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_problem_incident"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_problems"`);

    // Drop enums
    await queryRunner.query(
      `DROP TYPE IF EXISTS "itsm_problem_change_link_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "itsm_problem_incident_link_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "itsm_problem_risk_level_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "itsm_problem_source_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "itsm_problem_category_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "itsm_problem_urgency_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "itsm_problem_impact_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "itsm_problem_priority_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "itsm_problem_state_enum"`);
  }
}
