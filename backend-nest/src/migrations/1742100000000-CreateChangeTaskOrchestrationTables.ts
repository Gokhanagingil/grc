import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChangeTaskOrchestrationTables1742100000000
  implements MigrationInterface
{
  name = 'CreateChangeTaskOrchestrationTables1742100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Change Tasks ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_change_tasks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "change_id" uuid NOT NULL,
        "number" varchar(50) NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "status" varchar(30) NOT NULL DEFAULT 'DRAFT',
        "task_type" varchar(30) NOT NULL DEFAULT 'OTHER',
        "assignment_group_id" uuid,
        "assignee_id" uuid,
        "priority" varchar(20) NOT NULL DEFAULT 'MEDIUM',
        "planned_start_at" timestamptz,
        "planned_end_at" timestamptz,
        "actual_start_at" timestamptz,
        "actual_end_at" timestamptz,
        "sequence_order" int,
        "is_blocking" boolean NOT NULL DEFAULT true,
        "auto_generated" boolean NOT NULL DEFAULT false,
        "source_template_id" uuid,
        "template_task_key" varchar(100),
        "sort_order" int NOT NULL DEFAULT 0,
        "stage_label" varchar(100),
        "notes" text,
        "estimated_duration_minutes" int,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_change_tasks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_change_tasks_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_itsm_change_tasks_change" FOREIGN KEY ("change_id") REFERENCES "itsm_changes"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_itsm_change_tasks_tenant_change" ON "itsm_change_tasks" ("tenant_id", "change_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_itsm_change_tasks_tenant_change_number" ON "itsm_change_tasks" ("tenant_id", "change_id", "number")`);
    await queryRunner.query(`CREATE INDEX "IDX_itsm_change_tasks_tenant_status" ON "itsm_change_tasks" ("tenant_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_itsm_change_tasks_tenant_assignee" ON "itsm_change_tasks" ("tenant_id", "assignee_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_itsm_change_tasks_tenant_group" ON "itsm_change_tasks" ("tenant_id", "assignment_group_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_itsm_change_tasks_tenant_id" ON "itsm_change_tasks" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_itsm_change_tasks_created_at" ON "itsm_change_tasks" ("created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_itsm_change_tasks_updated_at" ON "itsm_change_tasks" ("updated_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_itsm_change_tasks_is_deleted" ON "itsm_change_tasks" ("is_deleted")`);

    // ── Change Task Dependencies ──────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_change_task_dependencies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "change_id" uuid NOT NULL,
        "predecessor_task_id" uuid NOT NULL,
        "successor_task_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_itsm_change_task_deps" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_ctd_predecessor" FOREIGN KEY ("predecessor_task_id") REFERENCES "itsm_change_tasks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_itsm_ctd_successor" FOREIGN KEY ("successor_task_id") REFERENCES "itsm_change_tasks"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_itsm_ctd_tenant_pred_succ" UNIQUE ("tenant_id", "predecessor_task_id", "successor_task_id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_itsm_ctd_tenant_change" ON "itsm_change_task_dependencies" ("tenant_id", "change_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_itsm_ctd_tenant_successor" ON "itsm_change_task_dependencies" ("tenant_id", "successor_task_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_itsm_ctd_tenant_predecessor" ON "itsm_change_task_dependencies" ("tenant_id", "predecessor_task_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_itsm_ctd_tenant_id" ON "itsm_change_task_dependencies" ("tenant_id")`);

    // ── Change Templates ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_change_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "code" varchar(50) NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "is_global" boolean NOT NULL DEFAULT false,
        "version" int NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_change_templates" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_change_templates_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_itsm_change_templates_tenant_code" ON "itsm_change_templates" ("tenant_id", "code")`);
    await queryRunner.query(`CREATE INDEX "IDX_itsm_change_templates_tenant_active" ON "itsm_change_templates" ("tenant_id", "is_active")`);
    await queryRunner.query(`CREATE INDEX "IDX_itsm_change_templates_tenant_id" ON "itsm_change_templates" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_itsm_change_templates_created_at" ON "itsm_change_templates" ("created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_itsm_change_templates_updated_at" ON "itsm_change_templates" ("updated_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_itsm_change_templates_is_deleted" ON "itsm_change_templates" ("is_deleted")`);

    // ── Change Template Tasks ─────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_change_template_tasks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "template_id" uuid NOT NULL,
        "task_key" varchar(100) NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "task_type" varchar(30) NOT NULL DEFAULT 'OTHER',
        "default_assignment_group_id" uuid,
        "default_assignee_id" uuid,
        "default_status" varchar(30) NOT NULL DEFAULT 'OPEN',
        "default_priority" varchar(20) NOT NULL DEFAULT 'MEDIUM',
        "estimated_duration_minutes" int,
        "sequence_order" int,
        "is_blocking" boolean NOT NULL DEFAULT true,
        "sort_order" int NOT NULL DEFAULT 0,
        "stage_label" varchar(100),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_change_template_tasks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_ctt_template" FOREIGN KEY ("template_id") REFERENCES "itsm_change_templates"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_itsm_ctt_tenant_template" ON "itsm_change_template_tasks" ("tenant_id", "template_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_itsm_ctt_tenant_template_key" ON "itsm_change_template_tasks" ("tenant_id", "template_id", "task_key")`);
    await queryRunner.query(`CREATE INDEX "IDX_itsm_ctt_tenant_id" ON "itsm_change_template_tasks" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_itsm_ctt_created_at" ON "itsm_change_template_tasks" ("created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_itsm_ctt_updated_at" ON "itsm_change_template_tasks" ("updated_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_itsm_ctt_is_deleted" ON "itsm_change_template_tasks" ("is_deleted")`);

    // ── Change Template Dependencies ──────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_change_template_dependencies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "template_id" uuid NOT NULL,
        "predecessor_task_key" varchar(100) NOT NULL,
        "successor_task_key" varchar(100) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_itsm_change_template_deps" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_ctdep_template" FOREIGN KEY ("template_id") REFERENCES "itsm_change_templates"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_itsm_ctdep_tenant_tmpl_pred_succ" UNIQUE ("tenant_id", "template_id", "predecessor_task_key", "successor_task_key")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_itsm_ctdep_tenant_template" ON "itsm_change_template_dependencies" ("tenant_id", "template_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_itsm_ctdep_tenant_id" ON "itsm_change_template_dependencies" ("tenant_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_change_template_dependencies" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_change_template_tasks" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_change_templates" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_change_task_dependencies" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_change_tasks" CASCADE`);
  }
}
