import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMajorIncidentTables1741400000000 implements MigrationInterface {
  name = 'CreateMajorIncidentTables1741400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums
    await queryRunner.query(`
      CREATE TYPE "itsm_major_incident_status_enum" AS ENUM (
        'DECLARED', 'INVESTIGATING', 'MITIGATING', 'MONITORING',
        'RESOLVED', 'PIR_PENDING', 'CLOSED'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "itsm_major_incident_severity_enum" AS ENUM (
        'SEV1', 'SEV2', 'SEV3'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "itsm_mi_update_type_enum" AS ENUM (
        'STATUS_CHANGE', 'STAKEHOLDER_UPDATE', 'TECHNICAL_UPDATE',
        'DECISION', 'ESCALATION', 'COMMUNICATION', 'ACTION_TAKEN', 'BRIDGE_NOTE'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "itsm_mi_update_visibility_enum" AS ENUM (
        'INTERNAL', 'EXTERNAL'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "itsm_mi_link_type_enum" AS ENUM (
        'INCIDENT', 'CHANGE', 'PROBLEM', 'CMDB_SERVICE', 'CMDB_OFFERING', 'CMDB_CI'
      )
    `);

    // Create itsm_major_incidents table
    await queryRunner.query(`
      CREATE TABLE "itsm_major_incidents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "number" varchar(20) NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "status" "itsm_major_incident_status_enum" NOT NULL DEFAULT 'DECLARED',
        "severity" "itsm_major_incident_severity_enum" NOT NULL DEFAULT 'SEV1',
        "commander_id" uuid,
        "communications_lead_id" uuid,
        "tech_lead_id" uuid,
        "bridge_url" varchar(500),
        "bridge_channel" varchar(255),
        "bridge_started_at" timestamptz,
        "bridge_ended_at" timestamptz,
        "customer_impact_summary" text,
        "business_impact_summary" text,
        "primary_service_id" uuid,
        "primary_offering_id" uuid,
        "declared_at" timestamptz,
        "resolved_at" timestamptz,
        "closed_at" timestamptz,
        "resolution_summary" text,
        "resolution_code" varchar(100),
        "source_incident_id" uuid,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" varchar(255),
        "updated_by" varchar(255),
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_major_incidents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_major_incidents_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for itsm_major_incidents
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_mi_tenant_number" ON "itsm_major_incidents" ("tenant_id", "number")`);
    await queryRunner.query(`CREATE INDEX "IDX_mi_tenant_status" ON "itsm_major_incidents" ("tenant_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_mi_tenant_severity" ON "itsm_major_incidents" ("tenant_id", "severity")`);
    await queryRunner.query(`CREATE INDEX "IDX_mi_tenant_created" ON "itsm_major_incidents" ("tenant_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_mi_tenant_commander" ON "itsm_major_incidents" ("tenant_id", "commander_id")`);

    // Create itsm_major_incident_updates table
    await queryRunner.query(`
      CREATE TABLE "itsm_major_incident_updates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "major_incident_id" uuid NOT NULL,
        "message" text NOT NULL,
        "update_type" "itsm_mi_update_type_enum" NOT NULL DEFAULT 'TECHNICAL_UPDATE',
        "visibility" "itsm_mi_update_visibility_enum" NOT NULL DEFAULT 'INTERNAL',
        "previous_status" varchar(50),
        "new_status" varchar(50),
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" varchar(255),
        "updated_by" varchar(255),
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_mi_updates" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_mi_updates_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_itsm_mi_updates_mi" FOREIGN KEY ("major_incident_id")
          REFERENCES "itsm_major_incidents"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for itsm_major_incident_updates
    await queryRunner.query(`CREATE INDEX "IDX_mi_upd_tenant_mi_created" ON "itsm_major_incident_updates" ("tenant_id", "major_incident_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_mi_upd_tenant_mi_type" ON "itsm_major_incident_updates" ("tenant_id", "major_incident_id", "update_type")`);

    // Create itsm_major_incident_links table
    await queryRunner.query(`
      CREATE TABLE "itsm_major_incident_links" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "major_incident_id" uuid NOT NULL,
        "link_type" "itsm_mi_link_type_enum" NOT NULL,
        "linked_record_id" uuid NOT NULL,
        "linked_record_label" varchar(255),
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" varchar(255),
        "updated_by" varchar(255),
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_mi_links" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_mi_links_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_itsm_mi_links_mi" FOREIGN KEY ("major_incident_id")
          REFERENCES "itsm_major_incidents"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_mi_link_tenant_mi_type_record" UNIQUE ("tenant_id", "major_incident_id", "link_type", "linked_record_id")
      )
    `);

    // Create indexes for itsm_major_incident_links
    await queryRunner.query(`CREATE INDEX "IDX_mi_link_tenant_mi" ON "itsm_major_incident_links" ("tenant_id", "major_incident_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_mi_link_tenant_record" ON "itsm_major_incident_links" ("tenant_id", "linked_record_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_major_incident_links"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_major_incident_updates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_major_incidents"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "itsm_mi_link_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "itsm_mi_update_visibility_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "itsm_mi_update_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "itsm_major_incident_severity_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "itsm_major_incident_status_enum"`);
  }
}
