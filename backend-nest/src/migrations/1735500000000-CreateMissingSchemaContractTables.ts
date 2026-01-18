import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: CreateMissingSchemaContractTables
 *
 * Creates all missing tables required by entity metadata for schema contract validation.
 * This migration ensures that all entities have corresponding database tables.
 *
 * This migration runs after CreateGrcRequirementsTable (1735400000000)
 * to ensure all base tables exist for foreign key relationships.
 */
export class CreateMissingSchemaContractTables1735500000000
  implements MigrationInterface
{
  name = 'CreateMissingSchemaContractTables1735500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure uuid extension is available
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    // ============================================================================
    // Create Enum Types
    // ============================================================================

    // AuditRequirementStatus enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "audit_requirement_status_enum" AS ENUM ('planned', 'in_scope', 'sampled', 'tested', 'completed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // CapaType enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "capa_type_enum" AS ENUM ('corrective', 'preventive', 'both');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // CapaStatus enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "capa_status_enum" AS ENUM ('planned', 'in_progress', 'implemented', 'verified', 'rejected', 'closed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // ControlType enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "control_type_enum" AS ENUM ('preventive', 'detective', 'corrective');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // ControlImplementationType enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "control_implementation_type_enum" AS ENUM ('manual', 'automated', 'it_dependent');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // ControlStatus enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "control_status_enum" AS ENUM ('draft', 'in_design', 'implemented', 'inoperative', 'retired');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // ControlFrequency enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "control_frequency_enum" AS ENUM ('continuous', 'daily', 'weekly', 'monthly', 'quarterly', 'annual');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // EvidenceType enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "evidence_type_enum" AS ENUM ('document', 'screenshot', 'log', 'report', 'config_export', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // ClassificationTagType enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "classification_tag_type_enum" AS ENUM ('privacy', 'security', 'compliance');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // AuditStandard enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "audit_standard_enum" AS ENUM ('iso27001', 'iso22301', 'cobit', 'soc2', 'nist', 'pci_dss', 'gdpr', 'hipaa', 'custom');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // TemplateLanguage enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "template_language_enum" AS ENUM ('en', 'tr');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // PolicyVersionStatus enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "policy_version_status_enum" AS ENUM ('draft', 'in_review', 'approved', 'published', 'retired');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // RelationshipType enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "relationship_type_enum" AS ENUM ('primary', 'secondary');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // CoverageLevel enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "coverage_level_enum" AS ENUM ('full', 'partial', 'minimal');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // ProcessControlMethod enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "process_control_method_enum" AS ENUM ('script', 'sampling', 'interview', 'walkthrough', 'observation');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // ProcessControlFrequency enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "process_control_frequency_enum" AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'annually', 'event_driven');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // ControlResultType enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "control_result_type_enum" AS ENUM ('boolean', 'numeric', 'qualitative');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // ControlResultSource enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "control_result_source_enum" AS ENUM ('manual', 'scheduled_job', 'integration');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // ViolationSeverity enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "violation_severity_enum" AS ENUM ('low', 'medium', 'high', 'critical');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // ViolationStatus enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "violation_status_enum" AS ENUM ('open', 'in_progress', 'resolved');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // IncidentCategory enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "incident_category_enum" AS ENUM ('hardware', 'software', 'network', 'access', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // IncidentImpact enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "incident_impact_enum" AS ENUM ('low', 'medium', 'high');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // IncidentUrgency enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "incident_urgency_enum" AS ENUM ('low', 'medium', 'high');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // IncidentPriority enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "incident_priority_enum" AS ENUM ('p1', 'p2', 'p3', 'p4');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // IncidentStatus enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "incident_status_enum" AS ENUM ('open', 'in_progress', 'resolved', 'closed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // IncidentSource enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "incident_source_enum" AS ENUM ('user', 'monitoring', 'email', 'phone', 'self_service');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // JobStatus enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "job_status_enum" AS ENUM ('pending', 'running', 'success', 'failed', 'skipped');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // NotificationStatus enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "notification_status_enum" AS ENUM ('success', 'failed', 'disabled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // NotificationProviderType enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "notification_provider_type_enum" AS ENUM ('email', 'webhook');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // ============================================================================
    // Create Base Tables (no dependencies on other missing tables)
    // ============================================================================

    // grc_audit_report_templates
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_audit_report_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "standard" "audit_standard_enum" NOT NULL DEFAULT 'custom',
        "language" "template_language_enum" NOT NULL DEFAULT 'en',
        "template_body" text,
        "sections" jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_audit_report_templates" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_audit_report_templates_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_audit_report_templates_tenant_id" 
      ON "grc_audit_report_templates" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_audit_report_templates_tenant_standard" 
      ON "grc_audit_report_templates" ("tenant_id", "standard")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_audit_report_templates_tenant_language" 
      ON "grc_audit_report_templates" ("tenant_id", "language")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_audit_report_templates_tenant_name" 
      ON "grc_audit_report_templates" ("tenant_id", "name")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_audit_report_templates_created_at" 
      ON "grc_audit_report_templates" ("created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_audit_report_templates_updated_at" 
      ON "grc_audit_report_templates" ("updated_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_audit_report_templates_is_deleted" 
      ON "grc_audit_report_templates" ("is_deleted")
    `);

    // grc_classification_tags
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_classification_tags" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "tag_name" varchar(255) NOT NULL,
        "tag_type" "classification_tag_type_enum" NOT NULL,
        "description" text,
        "color" varchar(7),
        "is_system" boolean NOT NULL DEFAULT false,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_classification_tags" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_classification_tags_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_classification_tags_tenant_tag_name" 
      ON "grc_classification_tags" ("tenant_id", "tag_name")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_classification_tags_tenant_tag_type" 
      ON "grc_classification_tags" ("tenant_id", "tag_type")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_classification_tags_tenant_id" 
      ON "grc_classification_tags" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_classification_tags_created_at" 
      ON "grc_classification_tags" ("created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_classification_tags_updated_at" 
      ON "grc_classification_tags" ("updated_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_classification_tags_is_deleted" 
      ON "grc_classification_tags" ("is_deleted")
    `);

    // grc_controls
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_controls" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "code" varchar(50),
        "description" text,
        "type" "control_type_enum" NOT NULL DEFAULT 'preventive',
        "implementation_type" "control_implementation_type_enum" NOT NULL DEFAULT 'manual',
        "status" "control_status_enum" NOT NULL DEFAULT 'draft',
        "frequency" "control_frequency_enum",
        "owner_user_id" uuid,
        "effective_date" date,
        "last_tested_date" date,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_controls" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_controls_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_controls_owner" FOREIGN KEY ("owner_user_id") REFERENCES "nest_users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_controls_tenant_id" 
      ON "grc_controls" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_controls_tenant_status" 
      ON "grc_controls" ("tenant_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_controls_tenant_type" 
      ON "grc_controls" ("tenant_id", "type")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_controls_tenant_code" 
      ON "grc_controls" ("tenant_id", "code")
      WHERE "code" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_controls_tenant_status_created" 
      ON "grc_controls" ("tenant_id", "status", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_controls_created_at" 
      ON "grc_controls" ("created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_controls_updated_at" 
      ON "grc_controls" ("updated_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_controls_is_deleted" 
      ON "grc_controls" ("is_deleted")
    `);

    // grc_evidence
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_evidence" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "type" "evidence_type_enum" NOT NULL DEFAULT 'document',
        "location" varchar(500) NOT NULL,
        "hash" varchar(64),
        "file_size" integer,
        "mime_type" varchar(100),
        "collected_at" date,
        "collected_by_user_id" uuid,
        "expires_at" date,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_evidence" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_evidence_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_evidence_collected_by" FOREIGN KEY ("collected_by_user_id") REFERENCES "nest_users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_evidence_tenant_id" 
      ON "grc_evidence" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_evidence_tenant_type" 
      ON "grc_evidence" ("tenant_id", "type")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_evidence_tenant_collected_at" 
      ON "grc_evidence" ("tenant_id", "collected_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_evidence_tenant_created_at" 
      ON "grc_evidence" ("tenant_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_evidence_created_at" 
      ON "grc_evidence" ("created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_evidence_updated_at" 
      ON "grc_evidence" ("updated_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_evidence_is_deleted" 
      ON "grc_evidence" ("is_deleted")
    `);

    // grc_field_metadata
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_field_metadata" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "table_name" varchar(255) NOT NULL,
        "field_name" varchar(255) NOT NULL,
        "label" varchar(255),
        "description" text,
        "data_type" varchar(100),
        "is_sensitive" boolean NOT NULL DEFAULT false,
        "is_pii" boolean NOT NULL DEFAULT false,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_field_metadata" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_field_metadata_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_field_metadata_tenant_table_field" 
      ON "grc_field_metadata" ("tenant_id", "table_name", "field_name")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_field_metadata_tenant_id" 
      ON "grc_field_metadata" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_field_metadata_tenant_table" 
      ON "grc_field_metadata" ("tenant_id", "table_name")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_field_metadata_created_at" 
      ON "grc_field_metadata" ("created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_field_metadata_updated_at" 
      ON "grc_field_metadata" ("updated_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_field_metadata_is_deleted" 
      ON "grc_field_metadata" ("is_deleted")
    `);

    // grc_processes
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_processes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "code" varchar(50),
        "description" text,
        "owner_user_id" uuid,
        "category" varchar(100),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_processes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_processes_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_processes_owner" FOREIGN KEY ("owner_user_id") REFERENCES "nest_users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_processes_tenant_name" 
      ON "grc_processes" ("tenant_id", "name")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_processes_tenant_id" 
      ON "grc_processes" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_processes_tenant_code" 
      ON "grc_processes" ("tenant_id", "code")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_processes_tenant_category" 
      ON "grc_processes" ("tenant_id", "category")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_processes_tenant_is_active" 
      ON "grc_processes" ("tenant_id", "is_active")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_processes_created_at" 
      ON "grc_processes" ("created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_processes_updated_at" 
      ON "grc_processes" ("updated_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_processes_is_deleted" 
      ON "grc_processes" ("is_deleted")
    `);

    // itsm_incidents
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_incidents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "number" varchar(20) NOT NULL,
        "short_description" varchar(255) NOT NULL,
        "description" text,
        "category" "incident_category_enum" NOT NULL DEFAULT 'other',
        "impact" "incident_impact_enum" NOT NULL DEFAULT 'medium',
        "urgency" "incident_urgency_enum" NOT NULL DEFAULT 'medium',
        "priority" "incident_priority_enum" NOT NULL DEFAULT 'p3',
        "status" "incident_status_enum" NOT NULL DEFAULT 'open',
        "source" "incident_source_enum" NOT NULL DEFAULT 'user',
        "assignment_group" varchar(100),
        "assigned_to" uuid,
        "related_service" varchar(100),
        "related_risk_id" uuid,
        "related_policy_id" uuid,
        "first_response_at" timestamp,
        "resolved_at" timestamp,
        "resolution_notes" text,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_incidents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_incidents_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_itsm_incidents_assigned_to" FOREIGN KEY ("assigned_to") REFERENCES "nest_users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_itsm_incidents_related_risk" FOREIGN KEY ("related_risk_id") REFERENCES "grc_risks"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_itsm_incidents_related_policy" FOREIGN KEY ("related_policy_id") REFERENCES "grc_policies"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_itsm_incidents_tenant_number" 
      ON "itsm_incidents" ("tenant_id", "number")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_incidents_tenant_id" 
      ON "itsm_incidents" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_incidents_tenant_status" 
      ON "itsm_incidents" ("tenant_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_incidents_tenant_priority" 
      ON "itsm_incidents" ("tenant_id", "priority")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_incidents_tenant_assignment_group" 
      ON "itsm_incidents" ("tenant_id", "assignment_group")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_incidents_tenant_assigned_to" 
      ON "itsm_incidents" ("tenant_id", "assigned_to")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_incidents_tenant_created_at" 
      ON "itsm_incidents" ("tenant_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_incidents_created_at" 
      ON "itsm_incidents" ("created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_incidents_updated_at" 
      ON "itsm_incidents" ("updated_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_incidents_is_deleted" 
      ON "itsm_incidents" ("is_deleted")
    `);

    // job_runs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "job_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "job_name" varchar(64) NOT NULL,
        "status" "job_status_enum" NOT NULL DEFAULT 'pending',
        "message_code" varchar(64) NOT NULL,
        "summary" text,
        "details" jsonb,
        "error_code" varchar(64),
        "error_message" text,
        "duration_ms" integer NOT NULL DEFAULT 0,
        "started_at" timestamp NOT NULL,
        "completed_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_job_runs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_job_runs_job_name" 
      ON "job_runs" ("job_name")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_job_runs_job_name_started_at" 
      ON "job_runs" ("job_name", "started_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_job_runs_status_started_at" 
      ON "job_runs" ("status", "started_at")
    `);

    // nest_tenant_settings
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "nest_tenant_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "key" varchar(255) NOT NULL,
        "value" text NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_nest_tenant_settings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_nest_tenant_settings_tenant" FOREIGN KEY ("tenantId") REFERENCES "nest_tenants"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nest_tenant_settings_tenantId" 
      ON "nest_tenant_settings" ("tenantId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nest_tenant_settings_key" 
      ON "nest_tenant_settings" ("key")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_nest_tenant_settings_tenantId_key" 
      ON "nest_tenant_settings" ("tenantId", "key")
    `);

    // notification_logs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "user_id" uuid,
        "correlation_id" varchar(64) NOT NULL,
        "provider_type" "notification_provider_type_enum" NOT NULL,
        "status" "notification_status_enum" NOT NULL DEFAULT 'success',
        "message_code" varchar(64) NOT NULL,
        "subject" varchar(255),
        "body" text,
        "error_code" varchar(64),
        "error_message" text,
        "metadata" jsonb,
        "details" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_logs_tenant_id" 
      ON "notification_logs" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_logs_tenant_created_at" 
      ON "notification_logs" ("tenant_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_logs_correlation_id" 
      ON "notification_logs" ("correlation_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_logs_provider_type_status" 
      ON "notification_logs" ("provider_type", "status")
    `);

    // user_history
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "tenant_id" uuid,
        "email" varchar(255) NOT NULL,
        "role" varchar(20) NOT NULL,
        "first_name" varchar(100),
        "last_name" varchar(100),
        "is_active" boolean NOT NULL,
        "changed_by" uuid,
        "change_reason" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_history" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_history_user_id" 
      ON "user_history" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_history_user_id_created_at" 
      ON "user_history" ("user_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_history_tenant_id" 
      ON "user_history" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_history_tenant_id_created_at" 
      ON "user_history" ("tenant_id", "created_at")
    `);

    // ============================================================================
    // Create Dependent Tables (depend on base tables or existing tables)
    // ============================================================================

    // grc_audit_requirements (depends on grc_audits, grc_requirements - both exist)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_audit_requirements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "audit_id" uuid NOT NULL,
        "requirement_id" uuid NOT NULL,
        "status" "audit_requirement_status_enum",
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grc_audit_requirements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_audit_requirements_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_audit_requirements_audit" FOREIGN KEY ("audit_id") REFERENCES "grc_audits"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_audit_requirements_requirement" FOREIGN KEY ("requirement_id") REFERENCES "grc_requirements"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_audit_requirements_tenant_id" 
      ON "grc_audit_requirements" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_audit_requirements_audit_id" 
      ON "grc_audit_requirements" ("audit_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_audit_requirements_tenant_audit_requirement" 
      ON "grc_audit_requirements" ("tenant_id", "audit_id", "requirement_id")
    `);

    // grc_capas (depends on grc_issues - exists)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_capas" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "issue_id" uuid NOT NULL,
        "description" text NOT NULL,
        "type" "capa_type_enum" NOT NULL DEFAULT 'corrective',
        "status" "capa_status_enum" NOT NULL DEFAULT 'planned',
        "owner_user_id" uuid,
        "due_date" date,
        "completed_date" date,
        "verified_by_user_id" uuid,
        "verified_at" timestamp,
        "effectiveness" text,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_capas" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_capas_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_capas_issue" FOREIGN KEY ("issue_id") REFERENCES "grc_issues"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_capas_owner" FOREIGN KEY ("owner_user_id") REFERENCES "nest_users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_grc_capas_verified_by" FOREIGN KEY ("verified_by_user_id") REFERENCES "nest_users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_capas_tenant_id" 
      ON "grc_capas" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_capas_tenant_status" 
      ON "grc_capas" ("tenant_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_capas_tenant_issue_id" 
      ON "grc_capas" ("tenant_id", "issue_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_capas_tenant_status_created" 
      ON "grc_capas" ("tenant_id", "status", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_capas_created_at" 
      ON "grc_capas" ("created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_capas_updated_at" 
      ON "grc_capas" ("updated_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_capas_is_deleted" 
      ON "grc_capas" ("is_deleted")
    `);

    // grc_field_metadata_tags (depends on grc_field_metadata, grc_classification_tags)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_field_metadata_tags" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "field_metadata_id" uuid NOT NULL,
        "classification_tag_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grc_field_metadata_tags" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_field_metadata_tags_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_field_metadata_tags_field_metadata" FOREIGN KEY ("field_metadata_id") REFERENCES "grc_field_metadata"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_field_metadata_tags_classification_tag" FOREIGN KEY ("classification_tag_id") REFERENCES "grc_classification_tags"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_field_metadata_tags_tenant_id" 
      ON "grc_field_metadata_tags" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_field_metadata_tags_tenant_field_metadata" 
      ON "grc_field_metadata_tags" ("tenant_id", "field_metadata_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_field_metadata_tags_tenant_classification_tag" 
      ON "grc_field_metadata_tags" ("tenant_id", "classification_tag_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_field_metadata_tags_tenant_field_classification" 
      ON "grc_field_metadata_tags" ("tenant_id", "field_metadata_id", "classification_tag_id")
    `);

    // grc_issue_evidence (depends on grc_issues, grc_evidence - both exist)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_issue_evidence" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "issue_id" uuid NOT NULL,
        "evidence_id" uuid NOT NULL,
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grc_issue_evidence" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_issue_evidence_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_issue_evidence_issue" FOREIGN KEY ("issue_id") REFERENCES "grc_issues"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_issue_evidence_evidence" FOREIGN KEY ("evidence_id") REFERENCES "grc_evidence"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_issue_evidence_tenant_id" 
      ON "grc_issue_evidence" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_issue_evidence_issue_id" 
      ON "grc_issue_evidence" ("issue_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_issue_evidence_tenant_issue_evidence" 
      ON "grc_issue_evidence" ("tenant_id", "issue_id", "evidence_id")
    `);

    // grc_issue_requirements (depends on grc_issues, grc_requirements - both exist)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_issue_requirements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "issue_id" uuid NOT NULL,
        "requirement_id" uuid NOT NULL,
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grc_issue_requirements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_issue_requirements_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_issue_requirements_issue" FOREIGN KEY ("issue_id") REFERENCES "grc_issues"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_issue_requirements_requirement" FOREIGN KEY ("requirement_id") REFERENCES "grc_requirements"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_issue_requirements_tenant_id" 
      ON "grc_issue_requirements" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_issue_requirements_issue_id" 
      ON "grc_issue_requirements" ("issue_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_issue_requirements_tenant_issue_requirement" 
      ON "grc_issue_requirements" ("tenant_id", "issue_id", "requirement_id")
    `);

    // grc_policy_controls (depends on grc_policies, grc_controls - both exist)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_policy_controls" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "policy_id" uuid NOT NULL,
        "control_id" uuid NOT NULL,
        "coverage_level" "coverage_level_enum",
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grc_policy_controls" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_policy_controls_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_policy_controls_policy" FOREIGN KEY ("policy_id") REFERENCES "grc_policies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_policy_controls_control" FOREIGN KEY ("control_id") REFERENCES "grc_controls"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_policy_controls_tenant_id" 
      ON "grc_policy_controls" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_policy_controls_policy_id" 
      ON "grc_policy_controls" ("policy_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_policy_controls_tenant_policy_control" 
      ON "grc_policy_controls" ("tenant_id", "policy_id", "control_id")
    `);

    // grc_policy_versions (depends on grc_policies - exists)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_policy_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "policy_id" uuid NOT NULL,
        "version_number" varchar(20) NOT NULL,
        "content" text,
        "change_summary" text,
        "effective_date" date,
        "status" "policy_version_status_enum" NOT NULL DEFAULT 'draft',
        "published_at" timestamp,
        "published_by_user_id" uuid,
        "approved_at" timestamp,
        "approved_by_user_id" uuid,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_policy_versions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_policy_versions_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_policy_versions_policy" FOREIGN KEY ("policy_id") REFERENCES "grc_policies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_policy_versions_published_by" FOREIGN KEY ("published_by_user_id") REFERENCES "nest_users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_grc_policy_versions_approved_by" FOREIGN KEY ("approved_by_user_id") REFERENCES "nest_users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_policy_versions_tenant_id" 
      ON "grc_policy_versions" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_policy_versions_tenant_policy_id" 
      ON "grc_policy_versions" ("tenant_id", "policy_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_policy_versions_tenant_status" 
      ON "grc_policy_versions" ("tenant_id", "status")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_policy_versions_tenant_policy_version" 
      ON "grc_policy_versions" ("tenant_id", "policy_id", "version_number")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_policy_versions_created_at" 
      ON "grc_policy_versions" ("created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_policy_versions_updated_at" 
      ON "grc_policy_versions" ("updated_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_policy_versions_is_deleted" 
      ON "grc_policy_versions" ("is_deleted")
    `);

    // grc_process_controls (depends on grc_processes)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_process_controls" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "process_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "is_automated" boolean NOT NULL DEFAULT false,
        "method" "process_control_method_enum",
        "frequency" "process_control_frequency_enum",
        "expected_result_type" "control_result_type_enum" NOT NULL DEFAULT 'boolean',
        "parameters" jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "owner_user_id" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_process_controls" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_process_controls_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_process_controls_process" FOREIGN KEY ("process_id") REFERENCES "grc_processes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_process_controls_owner" FOREIGN KEY ("owner_user_id") REFERENCES "nest_users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_process_controls_tenant_id" 
      ON "grc_process_controls" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_process_controls_tenant_process_id" 
      ON "grc_process_controls" ("tenant_id", "process_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_process_controls_tenant_is_active" 
      ON "grc_process_controls" ("tenant_id", "is_active")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_process_controls_tenant_frequency" 
      ON "grc_process_controls" ("tenant_id", "frequency")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_process_controls_created_at" 
      ON "grc_process_controls" ("created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_process_controls_updated_at" 
      ON "grc_process_controls" ("updated_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_process_controls_is_deleted" 
      ON "grc_process_controls" ("is_deleted")
    `);

    // grc_requirement_controls (depends on grc_requirements, grc_controls - both exist)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_requirement_controls" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "requirement_id" uuid NOT NULL,
        "control_id" uuid NOT NULL,
        "coverage_level" "coverage_level_enum",
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grc_requirement_controls" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_requirement_controls_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_requirement_controls_requirement" FOREIGN KEY ("requirement_id") REFERENCES "grc_requirements"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_requirement_controls_control" FOREIGN KEY ("control_id") REFERENCES "grc_controls"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_requirement_controls_tenant_id" 
      ON "grc_requirement_controls" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_requirement_controls_requirement_id" 
      ON "grc_requirement_controls" ("requirement_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_requirement_controls_tenant_requirement_control" 
      ON "grc_requirement_controls" ("tenant_id", "requirement_id", "control_id")
    `);

    // grc_risk_controls (depends on grc_risks, grc_controls - both exist)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_risk_controls" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "risk_id" uuid NOT NULL,
        "control_id" uuid NOT NULL,
        "relationship_type" "relationship_type_enum",
        "effectiveness" varchar(50),
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grc_risk_controls" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_risk_controls_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_risk_controls_risk" FOREIGN KEY ("risk_id") REFERENCES "grc_risks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_risk_controls_control" FOREIGN KEY ("control_id") REFERENCES "grc_controls"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risk_controls_tenant_id" 
      ON "grc_risk_controls" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risk_controls_risk_id" 
      ON "grc_risk_controls" ("risk_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_risk_controls_tenant_risk_control" 
      ON "grc_risk_controls" ("tenant_id", "risk_id", "control_id")
    `);

    // grc_risk_policies (depends on grc_risks, grc_policies - both exist)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_risk_policies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "risk_id" uuid NOT NULL,
        "policy_id" uuid NOT NULL,
        "relationship_type" "relationship_type_enum",
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grc_risk_policies" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_risk_policies_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_risk_policies_risk" FOREIGN KEY ("risk_id") REFERENCES "grc_risks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_risk_policies_policy" FOREIGN KEY ("policy_id") REFERENCES "grc_policies"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risk_policies_tenant_id" 
      ON "grc_risk_policies" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risk_policies_risk_id" 
      ON "grc_risk_policies" ("risk_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_risk_policies_tenant_risk_policy" 
      ON "grc_risk_policies" ("tenant_id", "risk_id", "policy_id")
    `);

    // grc_risk_requirements (depends on grc_risks, grc_requirements - both exist)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_risk_requirements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "risk_id" uuid NOT NULL,
        "requirement_id" uuid NOT NULL,
        "relationship_type" "relationship_type_enum",
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grc_risk_requirements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_risk_requirements_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_risk_requirements_risk" FOREIGN KEY ("risk_id") REFERENCES "grc_risks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_risk_requirements_requirement" FOREIGN KEY ("requirement_id") REFERENCES "grc_requirements"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risk_requirements_tenant_id" 
      ON "grc_risk_requirements" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risk_requirements_risk_id" 
      ON "grc_risk_requirements" ("risk_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_risk_requirements_tenant_risk_requirement" 
      ON "grc_risk_requirements" ("tenant_id", "risk_id", "requirement_id")
    `);

    // grc_process_control_risks (depends on grc_process_controls, grc_risks)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_process_control_risks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "control_id" uuid NOT NULL,
        "risk_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grc_process_control_risks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_process_control_risks_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_process_control_risks_control" FOREIGN KEY ("control_id") REFERENCES "grc_process_controls"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_process_control_risks_risk" FOREIGN KEY ("risk_id") REFERENCES "grc_risks"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_process_control_risks_tenant_id" 
      ON "grc_process_control_risks" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_process_control_risks_tenant_control_id" 
      ON "grc_process_control_risks" ("tenant_id", "control_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_process_control_risks_tenant_risk_id" 
      ON "grc_process_control_risks" ("tenant_id", "risk_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_process_control_risks_tenant_control_risk" 
      ON "grc_process_control_risks" ("tenant_id", "control_id", "risk_id")
    `);

    // grc_control_results (depends on grc_process_controls)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_control_results" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "control_id" uuid NOT NULL,
        "execution_date" timestamp with time zone NOT NULL,
        "executor_user_id" uuid,
        "source" "control_result_source_enum" NOT NULL DEFAULT 'manual',
        "result_value_boolean" boolean,
        "result_value_number" decimal(18,4),
        "result_value_text" text,
        "is_compliant" boolean NOT NULL,
        "evidence_reference" varchar(500),
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_control_results" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_control_results_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_control_results_control" FOREIGN KEY ("control_id") REFERENCES "grc_process_controls"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_control_results_executor" FOREIGN KEY ("executor_user_id") REFERENCES "nest_users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_control_results_tenant_id" 
      ON "grc_control_results" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_control_results_tenant_control_id" 
      ON "grc_control_results" ("tenant_id", "control_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_control_results_tenant_execution_date" 
      ON "grc_control_results" ("tenant_id", "execution_date")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_control_results_tenant_is_compliant" 
      ON "grc_control_results" ("tenant_id", "is_compliant")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_control_results_tenant_control_execution" 
      ON "grc_control_results" ("tenant_id", "control_id", "execution_date")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_control_results_created_at" 
      ON "grc_control_results" ("created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_control_results_updated_at" 
      ON "grc_control_results" ("updated_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_control_results_is_deleted" 
      ON "grc_control_results" ("is_deleted")
    `);

    // grc_process_violations (depends on grc_process_controls, grc_control_results)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_process_violations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "control_id" uuid NOT NULL,
        "control_result_id" uuid NOT NULL,
        "severity" "violation_severity_enum" NOT NULL DEFAULT 'medium',
        "status" "violation_status_enum" NOT NULL DEFAULT 'open',
        "title" varchar(255) NOT NULL,
        "description" text,
        "linked_risk_id" uuid,
        "owner_user_id" uuid,
        "due_date" date,
        "resolution_notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_process_violations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_process_violations_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_process_violations_control" FOREIGN KEY ("control_id") REFERENCES "grc_process_controls"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_process_violations_control_result" FOREIGN KEY ("control_result_id") REFERENCES "grc_control_results"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_process_violations_linked_risk" FOREIGN KEY ("linked_risk_id") REFERENCES "grc_risks"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_grc_process_violations_owner" FOREIGN KEY ("owner_user_id") REFERENCES "nest_users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_process_violations_control_result_id" 
      ON "grc_process_violations" ("control_result_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_process_violations_tenant_id" 
      ON "grc_process_violations" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_process_violations_tenant_control_id" 
      ON "grc_process_violations" ("tenant_id", "control_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_process_violations_tenant_status" 
      ON "grc_process_violations" ("tenant_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_process_violations_tenant_severity" 
      ON "grc_process_violations" ("tenant_id", "severity")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_process_violations_tenant_linked_risk_id" 
      ON "grc_process_violations" ("tenant_id", "linked_risk_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_process_violations_created_at" 
      ON "grc_process_violations" ("created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_process_violations_updated_at" 
      ON "grc_process_violations" ("updated_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_process_violations_is_deleted" 
      ON "grc_process_violations" ("is_deleted")
    `);

    // ============================================================================
    // Create History Tables (depend on existing tables)
    // ============================================================================

    // grc_risk_history (depends on grc_risks - exists)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_risk_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "risk_id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "severity" "risk_severity_enum" NOT NULL,
        "status" "risk_status_enum" NOT NULL,
        "owner_user_id" uuid,
        "likelihood" integer,
        "impact" integer,
        "risk_score" integer,
        "mitigation" text,
        "metadata" jsonb,
        "changed_by" uuid,
        "change_reason" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grc_risk_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_risk_history_risk" FOREIGN KEY ("risk_id") REFERENCES "grc_risks"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risk_history_risk_id" 
      ON "grc_risk_history" ("risk_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risk_history_risk_id_created_at" 
      ON "grc_risk_history" ("risk_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risk_history_tenant_id" 
      ON "grc_risk_history" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risk_history_tenant_id_created_at" 
      ON "grc_risk_history" ("tenant_id", "created_at")
    `);

    // grc_requirement_history (depends on grc_requirements - exists)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_requirement_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "requirement_id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "type" varchar(50),
        "status" varchar(50) NOT NULL,
        "framework_id" uuid,
        "control_reference" varchar(100),
        "due_date" date,
        "assigned_to_user_id" uuid,
        "metadata" jsonb,
        "changed_by" uuid,
        "change_reason" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grc_requirement_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_requirement_history_requirement" FOREIGN KEY ("requirement_id") REFERENCES "grc_requirements"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_requirement_history_requirement_id" 
      ON "grc_requirement_history" ("requirement_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_requirement_history_requirement_id_created_at" 
      ON "grc_requirement_history" ("requirement_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_requirement_history_tenant_id" 
      ON "grc_requirement_history" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_requirement_history_tenant_id_created_at" 
      ON "grc_requirement_history" ("tenant_id", "created_at")
    `);

    // grc_policy_history (depends on grc_policies - exists)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_policy_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "policy_id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "content" text,
        "status" "policy_status_enum" NOT NULL,
        "owner_user_id" uuid,
        "version" varchar(50),
        "effective_date" date,
        "review_date" date,
        "category" varchar(100),
        "metadata" jsonb,
        "changed_by" uuid,
        "change_reason" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grc_policy_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_policy_history_policy" FOREIGN KEY ("policy_id") REFERENCES "grc_policies"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_policy_history_policy_id" 
      ON "grc_policy_history" ("policy_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_policy_history_policy_id_created_at" 
      ON "grc_policy_history" ("policy_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_policy_history_tenant_id" 
      ON "grc_policy_history" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_policy_history_tenant_id_created_at" 
      ON "grc_policy_history" ("tenant_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop history tables
    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_policy_history"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_requirement_history"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_risk_history"
    `);

    // Drop dependent tables
    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_process_violations"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_control_results"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_process_control_risks"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_risk_requirements"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_risk_policies"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_risk_controls"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_requirement_controls"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_process_controls"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_policy_versions"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_policy_controls"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_issue_requirements"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_issue_evidence"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_field_metadata_tags"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_capas"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_audit_requirements"
    `);

    // Drop base tables
    await queryRunner.query(`
      DROP TABLE IF EXISTS "user_history"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "notification_logs"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "nest_tenant_settings"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "job_runs"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "itsm_incidents"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_processes"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_field_metadata"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_evidence"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_controls"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_classification_tags"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "grc_audit_report_templates"
    `);

    // Drop enum types
    await queryRunner.query(`
      DROP TYPE IF EXISTS "notification_provider_type_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "notification_status_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "job_status_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "incident_source_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "incident_status_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "incident_priority_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "incident_urgency_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "incident_impact_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "incident_category_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "violation_status_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "violation_severity_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "control_result_source_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "control_result_type_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "process_control_frequency_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "process_control_method_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "coverage_level_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "relationship_type_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "policy_version_status_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "template_language_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "audit_standard_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "classification_tag_type_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "evidence_type_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "control_frequency_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "control_status_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "control_implementation_type_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "control_type_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "capa_status_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "capa_type_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "audit_requirement_status_enum"
    `);
  }
}

