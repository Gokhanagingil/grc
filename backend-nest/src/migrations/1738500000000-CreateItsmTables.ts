import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create ITSM (IT Service Management) Tables
 *
 * Creates the following tables (ITIL v5 aligned):
 * - itsm_services: IT services for incident/change management
 * - itsm_incidents: Incident records with lifecycle states
 * - itsm_changes: Change request records with approval workflow
 * - itsm_incident_risks: Link table for incident-risk relationships (GRC Bridge)
 * - itsm_incident_controls: Link table for incident-control relationships (GRC Bridge)
 * - itsm_change_risks: Link table for change-risk relationships (GRC Bridge)
 * - itsm_change_controls: Link table for change-control relationships (GRC Bridge)
 *
 * Also creates necessary enums and indexes for performance.
 */
export class CreateItsmTables1738500000000 implements MigrationInterface {
  name = 'CreateItsmTables1738500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ITSM Service enums
    await queryRunner.query(`
      CREATE TYPE "itsm_services_criticality_enum" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')
    `);

    await queryRunner.query(`
      CREATE TYPE "itsm_services_status_enum" AS ENUM ('ACTIVE', 'INACTIVE', 'DEPRECATED')
    `);

    // Create ITSM Incident enums
    await queryRunner.query(`
      CREATE TYPE "itsm_incidents_state_enum" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')
    `);

    await queryRunner.query(`
      CREATE TYPE "itsm_incidents_impact_enum" AS ENUM ('HIGH', 'MEDIUM', 'LOW')
    `);

    await queryRunner.query(`
      CREATE TYPE "itsm_incidents_urgency_enum" AS ENUM ('HIGH', 'MEDIUM', 'LOW')
    `);

    await queryRunner.query(`
      CREATE TYPE "itsm_incidents_priority_enum" AS ENUM ('P1', 'P2', 'P3', 'P4', 'P5')
    `);

    // Create ITSM Change enums
    await queryRunner.query(`
      CREATE TYPE "itsm_changes_type_enum" AS ENUM ('STANDARD', 'NORMAL', 'EMERGENCY')
    `);

    await queryRunner.query(`
      CREATE TYPE "itsm_changes_state_enum" AS ENUM ('DRAFT', 'ASSESS', 'AUTHORIZE', 'IMPLEMENT', 'REVIEW', 'CLOSED')
    `);

    await queryRunner.query(`
      CREATE TYPE "itsm_changes_risk_enum" AS ENUM ('LOW', 'MEDIUM', 'HIGH')
    `);

    await queryRunner.query(`
      CREATE TYPE "itsm_changes_approval_status_enum" AS ENUM ('NOT_REQUESTED', 'REQUESTED', 'APPROVED', 'REJECTED')
    `);

    // Create itsm_services table
    await queryRunner.query(`
      CREATE TABLE "itsm_services" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "criticality" "itsm_services_criticality_enum" NOT NULL DEFAULT 'MEDIUM',
        "status" "itsm_services_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "owner_user_id" uuid,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_services" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_services_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_itsm_services_owner" FOREIGN KEY ("owner_user_id") REFERENCES "nest_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "UQ_itsm_services_tenant_name" UNIQUE ("tenant_id", "name")
      )
    `);

    // Create indexes for itsm_services
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_services_tenant_id" ON "itsm_services" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_services_tenant_status" ON "itsm_services" ("tenant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_services_tenant_criticality" ON "itsm_services" ("tenant_id", "criticality")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_services_tenant_created_at" ON "itsm_services" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_services_is_deleted" ON "itsm_services" ("is_deleted")`,
    );

    // Create itsm_incidents table
    await queryRunner.query(`
      CREATE TABLE "itsm_incidents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "number" varchar(50) NOT NULL,
        "short_description" varchar(255) NOT NULL,
        "description" text,
        "state" "itsm_incidents_state_enum" NOT NULL DEFAULT 'NEW',
        "impact" "itsm_incidents_impact_enum" NOT NULL DEFAULT 'MEDIUM',
        "urgency" "itsm_incidents_urgency_enum" NOT NULL DEFAULT 'MEDIUM',
        "priority" "itsm_incidents_priority_enum" NOT NULL DEFAULT 'P3',
        "category" varchar(100),
        "requester_id" uuid,
        "assignee_id" uuid,
        "assignment_group_id" uuid,
        "service_id" uuid,
        "opened_at" timestamptz,
        "resolved_at" timestamptz,
        "closed_at" timestamptz,
        "resolution_notes" text,
        "risk_review_required" boolean NOT NULL DEFAULT false,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_incidents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_incidents_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_itsm_incidents_requester" FOREIGN KEY ("requester_id") REFERENCES "nest_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_itsm_incidents_assignee" FOREIGN KEY ("assignee_id") REFERENCES "nest_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_itsm_incidents_service" FOREIGN KEY ("service_id") REFERENCES "itsm_services"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "UQ_itsm_incidents_tenant_number" UNIQUE ("tenant_id", "number")
      )
    `);

    // Create indexes for itsm_incidents
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_incidents_tenant_id" ON "itsm_incidents" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_incidents_tenant_state" ON "itsm_incidents" ("tenant_id", "state")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_incidents_tenant_priority" ON "itsm_incidents" ("tenant_id", "priority")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_incidents_tenant_service" ON "itsm_incidents" ("tenant_id", "service_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_incidents_tenant_assignee" ON "itsm_incidents" ("tenant_id", "assignee_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_incidents_tenant_risk_review" ON "itsm_incidents" ("tenant_id", "risk_review_required")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_incidents_tenant_created_at" ON "itsm_incidents" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_incidents_is_deleted" ON "itsm_incidents" ("is_deleted")`,
    );

    // Create itsm_changes table
    await queryRunner.query(`
      CREATE TABLE "itsm_changes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "number" varchar(50) NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "type" "itsm_changes_type_enum" NOT NULL DEFAULT 'NORMAL',
        "state" "itsm_changes_state_enum" NOT NULL DEFAULT 'DRAFT',
        "risk" "itsm_changes_risk_enum" NOT NULL DEFAULT 'MEDIUM',
        "approval_status" "itsm_changes_approval_status_enum" NOT NULL DEFAULT 'NOT_REQUESTED',
        "requester_id" uuid,
        "assignee_id" uuid,
        "service_id" uuid,
        "planned_start_at" timestamptz,
        "planned_end_at" timestamptz,
        "actual_start_at" timestamptz,
        "actual_end_at" timestamptz,
        "implementation_plan" text,
        "backout_plan" text,
        "justification" text,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_changes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_changes_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_itsm_changes_requester" FOREIGN KEY ("requester_id") REFERENCES "nest_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_itsm_changes_assignee" FOREIGN KEY ("assignee_id") REFERENCES "nest_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_itsm_changes_service" FOREIGN KEY ("service_id") REFERENCES "itsm_services"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "UQ_itsm_changes_tenant_number" UNIQUE ("tenant_id", "number")
      )
    `);

    // Create indexes for itsm_changes
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_changes_tenant_id" ON "itsm_changes" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_changes_tenant_state" ON "itsm_changes" ("tenant_id", "state")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_changes_tenant_type" ON "itsm_changes" ("tenant_id", "type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_changes_tenant_risk" ON "itsm_changes" ("tenant_id", "risk")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_changes_tenant_approval" ON "itsm_changes" ("tenant_id", "approval_status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_changes_tenant_service" ON "itsm_changes" ("tenant_id", "service_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_changes_tenant_created_at" ON "itsm_changes" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_changes_is_deleted" ON "itsm_changes" ("is_deleted")`,
    );

    // Create GRC Bridge tables

    // itsm_incident_risks - Link incidents to GRC risks
    await queryRunner.query(`
      CREATE TABLE "itsm_incident_risks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "incident_id" uuid NOT NULL,
        "risk_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        CONSTRAINT "PK_itsm_incident_risks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_incident_risks_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_itsm_incident_risks_incident" FOREIGN KEY ("incident_id") REFERENCES "itsm_incidents"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_itsm_incident_risks_risk" FOREIGN KEY ("risk_id") REFERENCES "grc_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "UQ_itsm_incident_risks_tenant_incident_risk" UNIQUE ("tenant_id", "incident_id", "risk_id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_incident_risks_tenant_incident" ON "itsm_incident_risks" ("tenant_id", "incident_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_incident_risks_tenant_risk" ON "itsm_incident_risks" ("tenant_id", "risk_id")`,
    );

    // itsm_incident_controls - Link incidents to GRC controls
    await queryRunner.query(`
      CREATE TABLE "itsm_incident_controls" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "incident_id" uuid NOT NULL,
        "control_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        CONSTRAINT "PK_itsm_incident_controls" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_incident_controls_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_itsm_incident_controls_incident" FOREIGN KEY ("incident_id") REFERENCES "itsm_incidents"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_itsm_incident_controls_control" FOREIGN KEY ("control_id") REFERENCES "grc_controls"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "UQ_itsm_incident_controls_tenant_incident_control" UNIQUE ("tenant_id", "incident_id", "control_id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_incident_controls_tenant_incident" ON "itsm_incident_controls" ("tenant_id", "incident_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_incident_controls_tenant_control" ON "itsm_incident_controls" ("tenant_id", "control_id")`,
    );

    // itsm_change_risks - Link changes to GRC risks
    await queryRunner.query(`
      CREATE TABLE "itsm_change_risks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "change_id" uuid NOT NULL,
        "risk_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        CONSTRAINT "PK_itsm_change_risks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_change_risks_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_itsm_change_risks_change" FOREIGN KEY ("change_id") REFERENCES "itsm_changes"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_itsm_change_risks_risk" FOREIGN KEY ("risk_id") REFERENCES "grc_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "UQ_itsm_change_risks_tenant_change_risk" UNIQUE ("tenant_id", "change_id", "risk_id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_change_risks_tenant_change" ON "itsm_change_risks" ("tenant_id", "change_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_change_risks_tenant_risk" ON "itsm_change_risks" ("tenant_id", "risk_id")`,
    );

    // itsm_change_controls - Link changes to GRC controls
    await queryRunner.query(`
      CREATE TABLE "itsm_change_controls" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "change_id" uuid NOT NULL,
        "control_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        CONSTRAINT "PK_itsm_change_controls" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_change_controls_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_itsm_change_controls_change" FOREIGN KEY ("change_id") REFERENCES "itsm_changes"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_itsm_change_controls_control" FOREIGN KEY ("control_id") REFERENCES "grc_controls"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "UQ_itsm_change_controls_tenant_change_control" UNIQUE ("tenant_id", "change_id", "control_id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_change_controls_tenant_change" ON "itsm_change_controls" ("tenant_id", "change_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_change_controls_tenant_control" ON "itsm_change_controls" ("tenant_id", "control_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop GRC Bridge tables first (no dependencies)
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_change_controls"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_change_risks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_incident_controls"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_incident_risks"`);

    // Drop main ITSM tables (respecting FK constraints)
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_changes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_incidents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_services"`);

    // Drop ITSM Change enums
    await queryRunner.query(
      `DROP TYPE IF EXISTS "itsm_changes_approval_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "itsm_changes_risk_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "itsm_changes_state_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "itsm_changes_type_enum"`);

    // Drop ITSM Incident enums
    await queryRunner.query(
      `DROP TYPE IF EXISTS "itsm_incidents_priority_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "itsm_incidents_urgency_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "itsm_incidents_impact_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "itsm_incidents_state_enum"`);

    // Drop ITSM Service enums
    await queryRunner.query(`DROP TYPE IF EXISTS "itsm_services_status_enum"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "itsm_services_criticality_enum"`,
    );
  }
}
