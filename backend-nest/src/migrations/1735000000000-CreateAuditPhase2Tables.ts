import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: CreateAuditPhase2Tables
 *
 * Creates the 5 tables for Audit Phase 2 (Standards Library + Audit Scope):
 * - standards
 * - standard_clauses
 * - audit_scope_standards
 * - audit_scope_clauses
 * - grc_issue_clauses
 *
 * This migration is additive only - no existing tables or data are altered.
 */
export class CreateAuditPhase2Tables1735000000000 implements MigrationInterface {
  name = 'CreateAuditPhase2Tables1735000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create grc_audits table first (required by audit_scope_standards and audit_scope_clauses)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_audits" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "audit_type" varchar(50) NOT NULL DEFAULT 'internal',
        "status" varchar(50) NOT NULL DEFAULT 'planned',
        "risk_level" varchar(50) NOT NULL DEFAULT 'medium',
        "department" varchar(255),
        "owner_user_id" uuid,
        "lead_auditor_id" uuid,
        "planned_start_date" date,
        "planned_end_date" date,
        "actual_start_date" date,
        "actual_end_date" date,
        "scope" text,
        "objectives" text,
        "methodology" text,
        "findings_summary" text,
        "recommendations" text,
        "conclusion" text,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_audits" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_audits_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for grc_audits
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_audits_tenant_id" ON "grc_audits" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_audits_tenant_status" ON "grc_audits" ("tenant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_audits_tenant_audit_type" ON "grc_audits" ("tenant_id", "audit_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_audits_tenant_department" ON "grc_audits" ("tenant_id", "department")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_audits_tenant_status_created_at" ON "grc_audits" ("tenant_id", "status", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_audits_created_at" ON "grc_audits" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_audits_updated_at" ON "grc_audits" ("updated_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_audits_is_deleted" ON "grc_audits" ("is_deleted")`,
    );

    // Create grc_issues table (required by grc_issue_clauses)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_issues" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "type" varchar(50) NOT NULL DEFAULT 'other',
        "status" varchar(50) NOT NULL DEFAULT 'open',
        "severity" varchar(50) NOT NULL DEFAULT 'medium',
        "risk_id" uuid,
        "control_id" uuid,
        "audit_id" uuid,
        "raised_by_user_id" uuid,
        "owner_user_id" uuid,
        "discovered_date" date,
        "due_date" date,
        "resolved_date" date,
        "root_cause" text,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_issues" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_issues_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for grc_issues
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_issues_tenant_id" ON "grc_issues" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_issues_tenant_status" ON "grc_issues" ("tenant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_issues_tenant_severity" ON "grc_issues" ("tenant_id", "severity")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_issues_tenant_risk_id" ON "grc_issues" ("tenant_id", "risk_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_issues_tenant_control_id" ON "grc_issues" ("tenant_id", "control_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_issues_tenant_audit_id" ON "grc_issues" ("tenant_id", "audit_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_issues_tenant_status_created_at" ON "grc_issues" ("tenant_id", "status", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_issues_created_at" ON "grc_issues" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_issues_updated_at" ON "grc_issues" ("updated_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_issues_is_deleted" ON "grc_issues" ("is_deleted")`,
    );

    // Create standards table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "standards" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "code" varchar(100) NOT NULL,
        "name" varchar(255) NOT NULL,
        "short_name" varchar(100),
        "version" varchar(50),
        "domain" varchar(100),
        "description" text,
        "publisher" varchar(255),
        "published_date" date,
        "effective_date" date,
        "is_active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_standards" PRIMARY KEY ("id"),
        CONSTRAINT "FK_standards_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
      )
    `);

    // Create unique index on (tenant_id, code)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_standards_tenant_code_unique" 
      ON "standards" ("tenant_id", "code") 
      WHERE "is_deleted" = false
    `);

    // Create unique index on (tenant_id, code, version)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_standards_tenant_code_version_unique" 
      ON "standards" ("tenant_id", "code", "version") 
      WHERE "is_deleted" = false AND "version" IS NOT NULL
    `);

    // Create standard indexes for standards
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_standards_tenant_id" ON "standards" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_standards_code" ON "standards" ("code")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_standards_domain" ON "standards" ("tenant_id", "domain")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_standards_created_at" ON "standards" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_standards_updated_at" ON "standards" ("updated_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_standards_is_deleted" ON "standards" ("is_deleted")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_standards_is_active" ON "standards" ("tenant_id", "is_active", "is_deleted")`,
    );

    // Create standard_clauses table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "standard_clauses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "standard_id" uuid NOT NULL,
        "code" varchar(100) NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "description_long" text,
        "parent_id" uuid,
        "hierarchy_level" integer NOT NULL DEFAULT 0,
        "level" integer NOT NULL DEFAULT 1,
        "sort_order" integer NOT NULL DEFAULT 0,
        "path" varchar(500),
        "is_auditable" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_standard_clauses" PRIMARY KEY ("id"),
        CONSTRAINT "FK_standard_clauses_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_standard_clauses_standard" FOREIGN KEY ("standard_id") REFERENCES "standards"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_standard_clauses_parent" FOREIGN KEY ("parent_id") REFERENCES "standard_clauses"("id") ON DELETE SET NULL
      )
    `);

    // Create unique index on (tenant_id, standard_id, code)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_standard_clauses_tenant_standard_code_unique" 
      ON "standard_clauses" ("tenant_id", "standard_id", "code") 
      WHERE "is_deleted" = false
    `);

    // Create standard indexes for standard_clauses
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_standard_clauses_tenant_id" ON "standard_clauses" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_standard_clauses_standard_id" ON "standard_clauses" ("standard_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_standard_clauses_parent_id" ON "standard_clauses" ("tenant_id", "parent_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_standard_clauses_code" ON "standard_clauses" ("tenant_id", "code")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_standard_clauses_created_at" ON "standard_clauses" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_standard_clauses_updated_at" ON "standard_clauses" ("updated_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_standard_clauses_is_deleted" ON "standard_clauses" ("is_deleted")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_standard_clauses_level" ON "standard_clauses" ("tenant_id", "standard_id", "level")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_standard_clauses_path" ON "standard_clauses" ("tenant_id", "path")`,
    );

    // Create audit_scope_standards table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_scope_standards" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "audit_id" uuid NOT NULL,
        "standard_id" uuid NOT NULL,
        "scope_type" varchar(20) NOT NULL DEFAULT 'full',
        "is_locked" boolean NOT NULL DEFAULT false,
        "locked_at" timestamp,
        "locked_by" uuid,
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_scope_standards" PRIMARY KEY ("id"),
        CONSTRAINT "FK_audit_scope_standards_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_audit_scope_standards_audit" FOREIGN KEY ("audit_id") REFERENCES "grc_audits"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_audit_scope_standards_standard" FOREIGN KEY ("standard_id") REFERENCES "standards"("id") ON DELETE CASCADE
      )
    `);

    // Create unique index on (tenant_id, audit_id, standard_id)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_audit_scope_standards_tenant_audit_standard_unique" 
      ON "audit_scope_standards" ("tenant_id", "audit_id", "standard_id")
    `);

    // Create standard indexes for audit_scope_standards
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_scope_standards_tenant_id" ON "audit_scope_standards" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_scope_standards_audit_id" ON "audit_scope_standards" ("audit_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_scope_standards_standard_id" ON "audit_scope_standards" ("tenant_id", "standard_id")`,
    );

    // Create audit_scope_clauses table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_scope_clauses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "audit_id" uuid NOT NULL,
        "clause_id" uuid NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'not_started',
        "is_locked" boolean NOT NULL DEFAULT false,
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_scope_clauses" PRIMARY KEY ("id"),
        CONSTRAINT "FK_audit_scope_clauses_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_audit_scope_clauses_audit" FOREIGN KEY ("audit_id") REFERENCES "grc_audits"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_audit_scope_clauses_clause" FOREIGN KEY ("clause_id") REFERENCES "standard_clauses"("id") ON DELETE CASCADE
      )
    `);

    // Create unique index on (tenant_id, audit_id, clause_id)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_audit_scope_clauses_tenant_audit_clause_unique" 
      ON "audit_scope_clauses" ("tenant_id", "audit_id", "clause_id")
    `);

    // Create standard indexes for audit_scope_clauses
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_scope_clauses_tenant_id" ON "audit_scope_clauses" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_scope_clauses_audit_id" ON "audit_scope_clauses" ("audit_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_scope_clauses_clause_id" ON "audit_scope_clauses" ("tenant_id", "clause_id")`,
    );

    // Create grc_issue_clauses table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grc_issue_clauses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "issue_id" uuid NOT NULL,
        "clause_id" uuid NOT NULL,
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grc_issue_clauses" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_issue_clauses_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_issue_clauses_issue" FOREIGN KEY ("issue_id") REFERENCES "grc_issues"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_grc_issue_clauses_clause" FOREIGN KEY ("clause_id") REFERENCES "standard_clauses"("id") ON DELETE CASCADE
      )
    `);

    // Create unique index on (tenant_id, issue_id, clause_id)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_issue_clauses_tenant_issue_clause_unique" 
      ON "grc_issue_clauses" ("tenant_id", "issue_id", "clause_id")
    `);

    // Create standard indexes for grc_issue_clauses
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_issue_clauses_tenant_id" ON "grc_issue_clauses" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_issue_clauses_issue_id" ON "grc_issue_clauses" ("issue_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_issue_clauses_clause_id" ON "grc_issue_clauses" ("tenant_id", "clause_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order (respecting foreign key dependencies)
    await queryRunner.query(`DROP TABLE IF EXISTS "grc_issue_clauses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "grc_issues"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_scope_clauses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_scope_standards"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "grc_audits"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "standard_clauses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "standards"`);
  }
}
