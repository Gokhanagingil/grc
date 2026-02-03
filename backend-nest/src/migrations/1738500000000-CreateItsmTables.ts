import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create ITSM (IT Service Management) Tables
 *
 * Creates the following tables (ITIL v5 aligned):
 * - itsm_services: IT services for incident/change management
 * - itsm_changes: Change request records with approval workflow
 * - itsm_incident_risks: Link table for incident-risk relationships (GRC Bridge)
 * - itsm_incident_controls: Link table for incident-control relationships (GRC Bridge)
 * - itsm_change_risks: Link table for change-risk relationships (GRC Bridge)
 * - itsm_change_controls: Link table for change-control relationships (GRC Bridge)
 *
 * Also adds new columns to existing itsm_incidents table and creates necessary enums.
 *
 * NOTE: itsm_incidents table already exists from migration 1735500000000.
 * This migration only adds new columns and creates new related tables.
 */
export class CreateItsmTables1738500000000 implements MigrationInterface {
  name = 'CreateItsmTables1738500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ITSM Service enums (only if they don't exist)
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "itsm_services_criticality_enum" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "itsm_services_status_enum" AS ENUM ('ACTIVE', 'INACTIVE', 'DEPRECATED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create ITSM Change enums (only if they don't exist)
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "itsm_changes_type_enum" AS ENUM ('STANDARD', 'NORMAL', 'EMERGENCY');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "itsm_changes_state_enum" AS ENUM ('DRAFT', 'ASSESS', 'AUTHORIZE', 'IMPLEMENT', 'REVIEW', 'CLOSED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "itsm_changes_risk_enum" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "itsm_changes_approval_status_enum" AS ENUM ('NOT_REQUESTED', 'REQUESTED', 'APPROVED', 'REJECTED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create itsm_services table (IF NOT EXISTS)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_services" (
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
        CONSTRAINT "PK_itsm_services" PRIMARY KEY ("id")
      )
    `);

    // Add constraints if they don't exist (using DO blocks)
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_services" ADD CONSTRAINT "FK_itsm_services_tenant" 
          FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_services" ADD CONSTRAINT "FK_itsm_services_owner" 
          FOREIGN KEY ("owner_user_id") REFERENCES "nest_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_services" ADD CONSTRAINT "UQ_itsm_services_tenant_name" UNIQUE ("tenant_id", "name");
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create indexes for itsm_services (IF NOT EXISTS)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_services_tenant_id" ON "itsm_services" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_services_tenant_status" ON "itsm_services" ("tenant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_services_tenant_criticality" ON "itsm_services" ("tenant_id", "criticality")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_services_tenant_created_at" ON "itsm_services" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_services_is_deleted" ON "itsm_services" ("is_deleted")`,
    );

    // Add new columns to existing itsm_incidents table (IF NOT EXISTS)
    // The itsm_incidents table was created in migration 1735500000000
    // We add columns that our new entity needs but the old schema doesn't have

    // Add service_id column for linking to itsm_services
    await queryRunner.query(`
      ALTER TABLE "itsm_incidents" ADD COLUMN IF NOT EXISTS "service_id" uuid
    `);

    // Add risk_review_required column for GRC Bridge
    await queryRunner.query(`
      ALTER TABLE "itsm_incidents" ADD COLUMN IF NOT EXISTS "risk_review_required" boolean DEFAULT false
    `);

    // Add FK constraint for service_id if it doesn't exist
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_incidents" ADD CONSTRAINT "FK_itsm_incidents_service" 
          FOREIGN KEY ("service_id") REFERENCES "itsm_services"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add index for service_id
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_incidents_tenant_service" ON "itsm_incidents" ("tenant_id", "service_id")`,
    );

    // Add index for risk_review_required
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_incidents_tenant_risk_review" ON "itsm_incidents" ("tenant_id", "risk_review_required")`,
    );

    // Create itsm_changes table (IF NOT EXISTS)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_changes" (
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
        CONSTRAINT "PK_itsm_changes" PRIMARY KEY ("id")
      )
    `);

    // Add constraints for itsm_changes (using DO blocks for idempotency)
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_changes" ADD CONSTRAINT "FK_itsm_changes_tenant" 
          FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_changes" ADD CONSTRAINT "FK_itsm_changes_requester" 
          FOREIGN KEY ("requester_id") REFERENCES "nest_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_changes" ADD CONSTRAINT "FK_itsm_changes_assignee" 
          FOREIGN KEY ("assignee_id") REFERENCES "nest_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_changes" ADD CONSTRAINT "FK_itsm_changes_service" 
          FOREIGN KEY ("service_id") REFERENCES "itsm_services"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_changes" ADD CONSTRAINT "UQ_itsm_changes_tenant_number" UNIQUE ("tenant_id", "number");
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create indexes for itsm_changes (IF NOT EXISTS)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_changes_tenant_id" ON "itsm_changes" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_changes_tenant_state" ON "itsm_changes" ("tenant_id", "state")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_changes_tenant_type" ON "itsm_changes" ("tenant_id", "type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_changes_tenant_risk" ON "itsm_changes" ("tenant_id", "risk")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_changes_tenant_approval" ON "itsm_changes" ("tenant_id", "approval_status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_changes_tenant_service" ON "itsm_changes" ("tenant_id", "service_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_changes_tenant_created_at" ON "itsm_changes" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_changes_is_deleted" ON "itsm_changes" ("is_deleted")`,
    );

    // Create GRC Bridge tables

    // itsm_incident_risks - Link incidents to GRC risks
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_incident_risks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "incident_id" uuid NOT NULL,
        "risk_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        CONSTRAINT "PK_itsm_incident_risks" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_incident_risks" ADD CONSTRAINT "FK_itsm_incident_risks_tenant" 
          FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_incident_risks" ADD CONSTRAINT "FK_itsm_incident_risks_incident" 
          FOREIGN KEY ("incident_id") REFERENCES "itsm_incidents"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_incident_risks" ADD CONSTRAINT "FK_itsm_incident_risks_risk" 
          FOREIGN KEY ("risk_id") REFERENCES "grc_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_incident_risks" ADD CONSTRAINT "UQ_itsm_incident_risks_tenant_incident_risk" 
          UNIQUE ("tenant_id", "incident_id", "risk_id");
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_incident_risks_tenant_incident" ON "itsm_incident_risks" ("tenant_id", "incident_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_incident_risks_tenant_risk" ON "itsm_incident_risks" ("tenant_id", "risk_id")`,
    );

    // itsm_incident_controls - Link incidents to GRC controls
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_incident_controls" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "incident_id" uuid NOT NULL,
        "control_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        CONSTRAINT "PK_itsm_incident_controls" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_incident_controls" ADD CONSTRAINT "FK_itsm_incident_controls_tenant" 
          FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_incident_controls" ADD CONSTRAINT "FK_itsm_incident_controls_incident" 
          FOREIGN KEY ("incident_id") REFERENCES "itsm_incidents"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_incident_controls" ADD CONSTRAINT "FK_itsm_incident_controls_control" 
          FOREIGN KEY ("control_id") REFERENCES "grc_controls"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_incident_controls" ADD CONSTRAINT "UQ_itsm_incident_controls_tenant_incident_control" 
          UNIQUE ("tenant_id", "incident_id", "control_id");
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_incident_controls_tenant_incident" ON "itsm_incident_controls" ("tenant_id", "incident_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_incident_controls_tenant_control" ON "itsm_incident_controls" ("tenant_id", "control_id")`,
    );

    // itsm_change_risks - Link changes to GRC risks
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_change_risks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "change_id" uuid NOT NULL,
        "risk_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        CONSTRAINT "PK_itsm_change_risks" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_change_risks" ADD CONSTRAINT "FK_itsm_change_risks_tenant" 
          FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_change_risks" ADD CONSTRAINT "FK_itsm_change_risks_change" 
          FOREIGN KEY ("change_id") REFERENCES "itsm_changes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_change_risks" ADD CONSTRAINT "FK_itsm_change_risks_risk" 
          FOREIGN KEY ("risk_id") REFERENCES "grc_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_change_risks" ADD CONSTRAINT "UQ_itsm_change_risks_tenant_change_risk" 
          UNIQUE ("tenant_id", "change_id", "risk_id");
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_change_risks_tenant_change" ON "itsm_change_risks" ("tenant_id", "change_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_change_risks_tenant_risk" ON "itsm_change_risks" ("tenant_id", "risk_id")`,
    );

    // itsm_change_controls - Link changes to GRC controls
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_change_controls" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "change_id" uuid NOT NULL,
        "control_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        CONSTRAINT "PK_itsm_change_controls" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_change_controls" ADD CONSTRAINT "FK_itsm_change_controls_tenant" 
          FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_change_controls" ADD CONSTRAINT "FK_itsm_change_controls_change" 
          FOREIGN KEY ("change_id") REFERENCES "itsm_changes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_change_controls" ADD CONSTRAINT "FK_itsm_change_controls_control" 
          FOREIGN KEY ("control_id") REFERENCES "grc_controls"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_change_controls" ADD CONSTRAINT "UQ_itsm_change_controls_tenant_change_control" 
          UNIQUE ("tenant_id", "change_id", "control_id");
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_change_controls_tenant_change" ON "itsm_change_controls" ("tenant_id", "change_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_change_controls_tenant_control" ON "itsm_change_controls" ("tenant_id", "control_id")`,
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
    // Note: We don't drop itsm_incidents as it was created by migration 1735500000000
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_services"`);

    // Remove columns added to itsm_incidents by this migration
    await queryRunner.query(
      `ALTER TABLE "itsm_incidents" DROP CONSTRAINT IF EXISTS "FK_itsm_incidents_service"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itsm_incidents" DROP COLUMN IF EXISTS "service_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itsm_incidents" DROP COLUMN IF EXISTS "risk_review_required"`,
    );

    // Drop ITSM Change enums
    await queryRunner.query(
      `DROP TYPE IF EXISTS "itsm_changes_approval_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "itsm_changes_risk_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "itsm_changes_state_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "itsm_changes_type_enum"`);

    // Drop ITSM Service enums
    await queryRunner.query(`DROP TYPE IF EXISTS "itsm_services_status_enum"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "itsm_services_criticality_enum"`,
    );
  }
}
