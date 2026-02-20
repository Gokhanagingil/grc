import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCmdbImportTables1740200000000 implements MigrationInterface {
  name = 'CreateCmdbImportTables1740200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums (idempotent: skip if exists)
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE cmdb_import_source_type_enum AS ENUM ('CSV', 'HTTP', 'WEBHOOK', 'JSON');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE cmdb_import_job_status_enum AS ENUM ('PENDING', 'PARSING', 'RECONCILING', 'COMPLETED', 'FAILED', 'APPLIED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE cmdb_import_row_status_enum AS ENUM ('PARSED', 'MATCHED', 'CREATED', 'UPDATED', 'CONFLICT', 'ERROR');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE cmdb_reconcile_action_enum AS ENUM ('CREATE', 'UPDATE', 'SKIP', 'CONFLICT');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // cmdb_import_source
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cmdb_import_source" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "type" cmdb_import_source_type_enum NOT NULL DEFAULT 'JSON',
        "config" jsonb,
        "enabled" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_cmdb_import_source" PRIMARY KEY ("id"),
        CONSTRAINT "FK_cmdb_import_source_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE
      )
    `);

    // cmdb_import_job
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cmdb_import_job" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "source_id" uuid,
        "status" cmdb_import_job_status_enum NOT NULL DEFAULT 'PENDING',
        "dry_run" boolean NOT NULL DEFAULT true,
        "total_rows" int NOT NULL DEFAULT 0,
        "parsed_count" int NOT NULL DEFAULT 0,
        "matched_count" int NOT NULL DEFAULT 0,
        "created_count" int NOT NULL DEFAULT 0,
        "updated_count" int NOT NULL DEFAULT 0,
        "conflict_count" int NOT NULL DEFAULT 0,
        "error_count" int NOT NULL DEFAULT 0,
        "started_at" TIMESTAMP,
        "finished_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_cmdb_import_job" PRIMARY KEY ("id"),
        CONSTRAINT "FK_cmdb_import_job_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_cmdb_import_job_source" FOREIGN KEY ("source_id") REFERENCES "cmdb_import_source"("id") ON DELETE SET NULL
      )
    `);

    // cmdb_import_row
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cmdb_import_row" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "job_id" uuid NOT NULL,
        "row_no" int NOT NULL,
        "raw" jsonb,
        "parsed" jsonb,
        "fingerprint" varchar(255),
        "status" cmdb_import_row_status_enum NOT NULL DEFAULT 'PARSED',
        "error_message" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_cmdb_import_row" PRIMARY KEY ("id"),
        CONSTRAINT "FK_cmdb_import_row_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_cmdb_import_row_job" FOREIGN KEY ("job_id") REFERENCES "cmdb_import_job"("id") ON DELETE CASCADE
      )
    `);

    // cmdb_reconcile_rule
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cmdb_reconcile_rule" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "target_class_id" uuid,
        "match_strategy" jsonb NOT NULL DEFAULT '{}',
        "precedence" int NOT NULL DEFAULT 0,
        "enabled" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_cmdb_reconcile_rule" PRIMARY KEY ("id"),
        CONSTRAINT "FK_cmdb_reconcile_rule_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE
      )
    `);

    // cmdb_reconcile_result
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cmdb_reconcile_result" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "job_id" uuid NOT NULL,
        "row_id" uuid,
        "ci_id" uuid,
        "action" cmdb_reconcile_action_enum NOT NULL DEFAULT 'CREATE',
        "matched_by" varchar(255),
        "diff" jsonb,
        "explain" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_cmdb_reconcile_result" PRIMARY KEY ("id"),
        CONSTRAINT "FK_cmdb_reconcile_result_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_cmdb_reconcile_result_job" FOREIGN KEY ("job_id") REFERENCES "cmdb_import_job"("id") ON DELETE CASCADE
      )
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cmdb_import_source_tenant" ON "cmdb_import_source" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cmdb_import_job_tenant" ON "cmdb_import_job" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cmdb_import_job_status" ON "cmdb_import_job" ("tenant_id", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cmdb_import_job_source" ON "cmdb_import_job" ("source_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cmdb_import_row_tenant" ON "cmdb_import_row" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cmdb_import_row_job" ON "cmdb_import_row" ("job_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cmdb_import_row_status" ON "cmdb_import_row" ("job_id", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cmdb_reconcile_rule_tenant" ON "cmdb_reconcile_rule" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cmdb_reconcile_rule_precedence" ON "cmdb_reconcile_rule" ("tenant_id", "precedence")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cmdb_reconcile_result_tenant" ON "cmdb_reconcile_result" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cmdb_reconcile_result_job" ON "cmdb_reconcile_result" ("job_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cmdb_reconcile_result_action" ON "cmdb_reconcile_result" ("job_id", "action")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cmdb_reconcile_result"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cmdb_reconcile_rule"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cmdb_import_row"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cmdb_import_job"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cmdb_import_source"`);
    await queryRunner.query(`DROP TYPE IF EXISTS cmdb_reconcile_action_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS cmdb_import_row_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS cmdb_import_job_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS cmdb_import_source_type_enum`);
  }
}
