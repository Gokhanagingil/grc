import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWebhookEndpointsTable1739400000000 implements MigrationInterface {
  name = 'CreateWebhookEndpointsTable1739400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sys_webhook_endpoints" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "base_url" varchar(2048) NOT NULL,
        "secret" varchar(512),
        "headers" jsonb NOT NULL DEFAULT '{}',
        "is_active" boolean NOT NULL DEFAULT true,
        "max_retries" int NOT NULL DEFAULT 3,
        "timeout_ms" int NOT NULL DEFAULT 10000,
        "description" text,
        "allow_insecure" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sys_webhook_endpoints" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_webhook_endpoints_tenant_id"
      ON "sys_webhook_endpoints" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_webhook_endpoints_tenant_active"
      ON "sys_webhook_endpoints" ("tenant_id", "is_active")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_webhook_endpoints_tenant_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_webhook_endpoints_tenant_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "sys_webhook_endpoints"`);
  }
}
