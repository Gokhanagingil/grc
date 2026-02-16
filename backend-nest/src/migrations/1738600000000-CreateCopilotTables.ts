import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create Copilot Tables
 *
 * Creates the following tables for the AI Copilot feature:
 * - copilot_incident_index: Local index of ServiceNow incidents for similarity search
 * - copilot_kb_index: Local index of ServiceNow KB articles for suggestions
 * - copilot_learning_events: Learning loop events (shown, applied, rejected)
 */
export class CreateCopilotTables1738600000000 implements MigrationInterface {
  name = 'CreateCopilotTables1738600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create learning event type enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "copilot_learning_event_type_enum" AS ENUM ('SUGGESTION_SHOWN', 'SUGGESTION_APPLIED', 'SUGGESTION_REJECTED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create copilot_incident_index table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "copilot_incident_index" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "sys_id" varchar(64) NOT NULL,
        "number" varchar(40),
        "short_description" text,
        "description" text,
        "state" varchar(40),
        "priority" varchar(40),
        "category" varchar(40),
        "assignment_group" varchar(200),
        "close_code" varchar(100),
        "close_notes" text,
        "resolution_notes" text,
        "resolved_at" timestamp,
        "closed_at" timestamp,
        "sn_created_at" timestamp,
        "sn_updated_at" timestamp,
        "search_text" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_copilot_incident_index" PRIMARY KEY ("id")
      )
    `);

    // Add FK constraint for tenant
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "copilot_incident_index" ADD CONSTRAINT "FK_copilot_incident_index_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Unique index on tenant + sys_id
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "copilot_incident_index" ADD CONSTRAINT "UQ_copilot_incident_index_tenant_sysid"
          UNIQUE ("tenant_id", "sys_id");
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Indexes for copilot_incident_index
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_copilot_incident_index_tenant_id" ON "copilot_incident_index" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_copilot_incident_index_tenant_state" ON "copilot_incident_index" ("tenant_id", "state")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_copilot_incident_index_tenant_resolved" ON "copilot_incident_index" ("tenant_id", "resolved_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_copilot_incident_index_is_deleted" ON "copilot_incident_index" ("is_deleted")`,
    );

    // Create copilot_kb_index table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "copilot_kb_index" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "sys_id" varchar(64) NOT NULL,
        "number" varchar(40),
        "title" text,
        "text" text,
        "category" varchar(100),
        "workflow_state" varchar(40),
        "sn_created_at" timestamp,
        "sn_updated_at" timestamp,
        "search_text" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_copilot_kb_index" PRIMARY KEY ("id")
      )
    `);

    // Add FK constraint for tenant
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "copilot_kb_index" ADD CONSTRAINT "FK_copilot_kb_index_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Unique index on tenant + sys_id
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "copilot_kb_index" ADD CONSTRAINT "UQ_copilot_kb_index_tenant_sysid"
          UNIQUE ("tenant_id", "sys_id");
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Indexes for copilot_kb_index
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_copilot_kb_index_tenant_id" ON "copilot_kb_index" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_copilot_kb_index_is_deleted" ON "copilot_kb_index" ("is_deleted")`,
    );

    // Create copilot_learning_events table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "copilot_learning_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "incident_sys_id" varchar(64) NOT NULL,
        "event_type" "copilot_learning_event_type_enum" NOT NULL,
        "action_type" varchar(100) NOT NULL,
        "confidence" float,
        "evidence_ids" jsonb,
        "payload" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_copilot_learning_events" PRIMARY KEY ("id")
      )
    `);

    // Add FK constraint for tenant
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "copilot_learning_events" ADD CONSTRAINT "FK_copilot_learning_events_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Indexes for copilot_learning_events
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_copilot_learning_events_tenant_id" ON "copilot_learning_events" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_copilot_learning_events_tenant_incident" ON "copilot_learning_events" ("tenant_id", "incident_sys_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_copilot_learning_events_tenant_type" ON "copilot_learning_events" ("tenant_id", "event_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_copilot_learning_events_tenant_created" ON "copilot_learning_events" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_copilot_learning_events_is_deleted" ON "copilot_learning_events" ("is_deleted")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "copilot_learning_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "copilot_kb_index"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "copilot_incident_index"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "copilot_learning_event_type_enum"`,
    );
  }
}
