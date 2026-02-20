import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSlaEngine1738700000000 implements MigrationInterface {
  name = 'CreateSlaEngine1738700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "itsm_sla_definitions_metric_enum" AS ENUM ('RESPONSE_TIME', 'RESOLUTION_TIME');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "itsm_sla_definitions_schedule_enum" AS ENUM ('24X7', 'BUSINESS_HOURS');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "itsm_sla_instances_status_enum" AS ENUM ('IN_PROGRESS', 'PAUSED', 'MET', 'BREACHED', 'CANCELLED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_sla_definitions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "metric" "itsm_sla_definitions_metric_enum" NOT NULL DEFAULT 'RESOLUTION_TIME',
        "target_seconds" int NOT NULL,
        "schedule" "itsm_sla_definitions_schedule_enum" NOT NULL DEFAULT '24X7',
        "business_start_hour" int NOT NULL DEFAULT 9,
        "business_end_hour" int NOT NULL DEFAULT 17,
        "business_days" jsonb NOT NULL DEFAULT '[1,2,3,4,5]',
        "priority_filter" jsonb,
        "service_id_filter" uuid,
        "stop_on_states" jsonb NOT NULL DEFAULT '["resolved","closed"]',
        "pause_on_states" jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "order" int NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_sla_definitions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_sla_definitions" ADD CONSTRAINT "FK_itsm_sla_definitions_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_sla_definitions" ADD CONSTRAINT "UQ_itsm_sla_definitions_tenant_name" UNIQUE ("tenant_id", "name");
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_sla_definitions_tenant_id" ON "itsm_sla_definitions" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_sla_definitions_tenant_active" ON "itsm_sla_definitions" ("tenant_id", "is_active")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_sla_definitions_is_deleted" ON "itsm_sla_definitions" ("is_deleted")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_sla_instances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "record_type" varchar(50) NOT NULL,
        "record_id" uuid NOT NULL,
        "definition_id" uuid NOT NULL,
        "start_at" timestamptz NOT NULL,
        "due_at" timestamptz NOT NULL,
        "stop_at" timestamptz,
        "pause_at" timestamptz,
        "paused_duration_seconds" int NOT NULL DEFAULT 0,
        "breached" boolean NOT NULL DEFAULT false,
        "elapsed_seconds" int NOT NULL DEFAULT 0,
        "remaining_seconds" int,
        "status" "itsm_sla_instances_status_enum" NOT NULL DEFAULT 'IN_PROGRESS',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_sla_instances" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_sla_instances" ADD CONSTRAINT "FK_itsm_sla_instances_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_sla_instances" ADD CONSTRAINT "FK_itsm_sla_instances_definition"
          FOREIGN KEY ("definition_id") REFERENCES "itsm_sla_definitions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_sla_instances_tenant_id" ON "itsm_sla_instances" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_sla_instances_tenant_record" ON "itsm_sla_instances" ("tenant_id", "record_type", "record_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_sla_instances_tenant_status" ON "itsm_sla_instances" ("tenant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_sla_instances_tenant_breached" ON "itsm_sla_instances" ("tenant_id", "breached")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_sla_instances_tenant_due_at" ON "itsm_sla_instances" ("tenant_id", "due_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_sla_instances_is_deleted" ON "itsm_sla_instances" ("is_deleted")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_sla_instances"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_sla_definitions"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "itsm_sla_instances_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "itsm_sla_definitions_schedule_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "itsm_sla_definitions_metric_enum"`,
    );
  }
}
