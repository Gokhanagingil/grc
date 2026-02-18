import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkflowBusinessRuleUiPolicy1738800000000
  implements MigrationInterface
{
  name = 'CreateWorkflowBusinessRuleUiPolicy1738800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "itsm_business_rule_trigger_enum" AS ENUM (
          'BEFORE_INSERT', 'AFTER_INSERT', 'BEFORE_UPDATE', 'AFTER_UPDATE'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_workflow_definitions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" varchar(255),
        "table_name" varchar(100) NOT NULL,
        "states" jsonb NOT NULL DEFAULT '[]',
        "transitions" jsonb NOT NULL DEFAULT '[]',
        "is_active" boolean NOT NULL DEFAULT true,
        "order" int NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_workflow_definitions" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_business_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" varchar(255),
        "table_name" varchar(100) NOT NULL,
        "trigger" "itsm_business_rule_trigger_enum" NOT NULL DEFAULT 'BEFORE_UPDATE',
        "conditions" jsonb,
        "actions" jsonb NOT NULL DEFAULT '[]',
        "is_active" boolean NOT NULL DEFAULT true,
        "order" int NOT NULL DEFAULT 100,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_business_rules" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_ui_policies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" varchar(255),
        "table_name" varchar(100) NOT NULL,
        "conditions" jsonb,
        "field_effects" jsonb NOT NULL DEFAULT '[]',
        "is_active" boolean NOT NULL DEFAULT true,
        "order" int NOT NULL DEFAULT 100,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_ui_policies" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_ui_actions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "label" varchar(100) NOT NULL,
        "description" varchar(255),
        "table_name" varchar(100) NOT NULL,
        "workflow_transition" varchar(100),
        "required_roles" jsonb,
        "show_conditions" jsonb,
        "style" varchar(20) NOT NULL DEFAULT 'secondary',
        "order" int NOT NULL DEFAULT 100,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_ui_actions" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_workflow_definitions"
          ADD CONSTRAINT "FK_itsm_workflow_definitions_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_business_rules"
          ADD CONSTRAINT "FK_itsm_business_rules_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_ui_policies"
          ADD CONSTRAINT "FK_itsm_ui_policies_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_ui_actions"
          ADD CONSTRAINT "FK_itsm_ui_actions_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_workflow_defs_tenant_table_active"
        ON "itsm_workflow_definitions" ("tenant_id", "table_name", "is_active");
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_itsm_workflow_defs_tenant_name"
        ON "itsm_workflow_definitions" ("tenant_id", "name")
        WHERE "is_deleted" = false;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_business_rules_tenant_table_trigger_active"
        ON "itsm_business_rules" ("tenant_id", "table_name", "trigger", "is_active");
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_itsm_business_rules_tenant_name"
        ON "itsm_business_rules" ("tenant_id", "name")
        WHERE "is_deleted" = false;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_ui_policies_tenant_table_active"
        ON "itsm_ui_policies" ("tenant_id", "table_name", "is_active");
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_itsm_ui_policies_tenant_name"
        ON "itsm_ui_policies" ("tenant_id", "name")
        WHERE "is_deleted" = false;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_ui_actions_tenant_table_active"
        ON "itsm_ui_actions" ("tenant_id", "table_name", "is_active");
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_itsm_ui_actions_tenant_name"
        ON "itsm_ui_actions" ("tenant_id", "name")
        WHERE "is_deleted" = false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "itsm_ui_actions" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "itsm_ui_policies" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "itsm_business_rules" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "itsm_workflow_definitions" CASCADE`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "itsm_business_rule_trigger_enum"`,
    );
  }
}
