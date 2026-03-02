import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceUserNotificationsForV01743400000000
  implements MigrationInterface
{
  name = 'EnhanceUserNotificationsForV01743400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns to sys_user_notifications for Notification Center v0
    await queryRunner.query(`
      ALTER TABLE "sys_user_notifications"
        ADD COLUMN IF NOT EXISTS "type" varchar(64) NOT NULL DEFAULT 'GENERAL',
        ADD COLUMN IF NOT EXISTS "severity" varchar(32) NOT NULL DEFAULT 'INFO',
        ADD COLUMN IF NOT EXISTS "source" varchar(64) NOT NULL DEFAULT 'SYSTEM',
        ADD COLUMN IF NOT EXISTS "entity_type" varchar(128),
        ADD COLUMN IF NOT EXISTS "entity_id" uuid,
        ADD COLUMN IF NOT EXISTS "due_at" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS "actions" jsonb DEFAULT '[]'
    `);

    // Index for filtering by type/source
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_user_notifications_type"
      ON "sys_user_notifications" ("tenant_id", "type")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_user_notifications_source"
      ON "sys_user_notifications" ("tenant_id", "source")
    `);

    // Index for deep-linking lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_user_notifications_entity"
      ON "sys_user_notifications" ("entity_type", "entity_id")
    `);

    // Index for due-date cron scanning
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_user_notifications_due_at"
      ON "sys_user_notifications" ("due_at")
      WHERE "due_at" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_user_notifications_due_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_user_notifications_entity"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_user_notifications_source"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_user_notifications_type"`,
    );

    await queryRunner.query(`
      ALTER TABLE "sys_user_notifications"
        DROP COLUMN IF EXISTS "actions",
        DROP COLUMN IF EXISTS "metadata",
        DROP COLUMN IF EXISTS "due_at",
        DROP COLUMN IF EXISTS "entity_id",
        DROP COLUMN IF EXISTS "entity_type",
        DROP COLUMN IF EXISTS "source",
        DROP COLUMN IF EXISTS "severity",
        DROP COLUMN IF EXISTS "type"
    `);
  }
}
