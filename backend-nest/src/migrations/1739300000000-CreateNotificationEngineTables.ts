import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationEngineTables1739300000000 implements MigrationInterface {
  name = 'CreateNotificationEngineTables1739300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sys_notification_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "subject" varchar(500),
        "body" text NOT NULL,
        "allowed_variables" jsonb NOT NULL DEFAULT '[]',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sys_notification_templates" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_notification_templates_tenant"
      ON "sys_notification_templates" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sys_notification_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "event_name" varchar(255) NOT NULL,
        "condition" jsonb NOT NULL DEFAULT '{}',
        "channels" jsonb NOT NULL DEFAULT '["IN_APP"]',
        "recipients" jsonb NOT NULL DEFAULT '[]',
        "template_id" uuid,
        "is_active" boolean NOT NULL DEFAULT true,
        "rate_limit_per_hour" int NOT NULL DEFAULT 100,
        "table_name" varchar(128),
        "description" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sys_notification_rules" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_notification_rules_tenant"
      ON "sys_notification_rules" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_notification_rules_tenant_event"
      ON "sys_notification_rules" ("tenant_id", "event_name")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_notification_rules_tenant_active"
      ON "sys_notification_rules" ("tenant_id", "is_active")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sys_notification_deliveries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "rule_id" uuid NOT NULL,
        "event_id" uuid,
        "channel" varchar(32) NOT NULL,
        "recipient" varchar(500) NOT NULL DEFAULT '',
        "status" varchar(32) NOT NULL DEFAULT 'PENDING',
        "attempts" int NOT NULL DEFAULT 0,
        "last_error" text,
        "provider_message_id" varchar(255),
        "payload_snapshot" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sys_notification_deliveries" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_notification_deliveries_tenant"
      ON "sys_notification_deliveries" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_notification_deliveries_tenant_created"
      ON "sys_notification_deliveries" ("tenant_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_notification_deliveries_rule_status"
      ON "sys_notification_deliveries" ("rule_id", "status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sys_user_notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "title" varchar(500) NOT NULL,
        "body" text NOT NULL,
        "link" varchar(1000),
        "delivery_id" uuid,
        "read_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sys_user_notifications" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_user_notifications_tenant"
      ON "sys_user_notifications" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_user_notifications_user"
      ON "sys_user_notifications" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_user_notifications_user_read"
      ON "sys_user_notifications" ("user_id", "read_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_user_notifications_tenant_user_created"
      ON "sys_user_notifications" ("tenant_id", "user_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sys_user_notifications"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "sys_notification_deliveries"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "sys_notification_rules"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "sys_notification_templates"`,
    );
  }
}
