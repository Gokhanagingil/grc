import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateApiCatalogTables1739500000000 implements MigrationInterface {
  name = 'CreateApiCatalogTables1739500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sys_published_apis" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(128) NOT NULL,
        "version" varchar(32) NOT NULL DEFAULT 'v1',
        "table_name" varchar(128) NOT NULL,
        "allowed_fields" jsonb NOT NULL DEFAULT '{"read":[],"write":[]}',
        "filter_policy" jsonb NOT NULL DEFAULT '[]',
        "allow_list" boolean NOT NULL DEFAULT true,
        "allow_create" boolean NOT NULL DEFAULT false,
        "allow_update" boolean NOT NULL DEFAULT false,
        "rate_limit_per_minute" int NOT NULL DEFAULT 60,
        "is_active" boolean NOT NULL DEFAULT true,
        "description" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sys_published_apis" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_published_apis_tenant_id"
      ON "sys_published_apis" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_sys_published_apis_tenant_name_version"
      ON "sys_published_apis" ("tenant_id", "name", "version")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_published_apis_tenant_active"
      ON "sys_published_apis" ("tenant_id", "is_active")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sys_api_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "key_hash" varchar(128) NOT NULL,
        "key_prefix" varchar(16) NOT NULL,
        "scopes" jsonb NOT NULL DEFAULT '[]',
        "is_active" boolean NOT NULL DEFAULT true,
        "expires_at" TIMESTAMP,
        "last_used_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sys_api_keys" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_api_keys_tenant_id"
      ON "sys_api_keys" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_sys_api_keys_key_hash"
      ON "sys_api_keys" ("key_hash")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_api_keys_tenant_active"
      ON "sys_api_keys" ("tenant_id", "is_active")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sys_api_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "api_key_id" uuid NOT NULL,
        "published_api_id" uuid NOT NULL,
        "method" varchar(10) NOT NULL,
        "path" varchar(512) NOT NULL,
        "status_code" int NOT NULL,
        "response_time_ms" int NOT NULL DEFAULT 0,
        "ip_address" varchar(45),
        "request_body" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sys_api_audit_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_api_audit_logs_tenant_created"
      ON "sys_api_audit_logs" ("tenant_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_api_audit_logs_key_created"
      ON "sys_api_audit_logs" ("api_key_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_api_audit_logs_key_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_api_audit_logs_tenant_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "sys_api_audit_logs"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_api_keys_tenant_active"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sys_api_keys_key_hash"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_api_keys_tenant_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "sys_api_keys"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_published_apis_tenant_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_published_apis_tenant_name_version"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_published_apis_tenant_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "sys_published_apis"`);
  }
}
