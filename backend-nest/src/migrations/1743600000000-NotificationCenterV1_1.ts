import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationCenterV1_11743600000000
  implements MigrationInterface
{
  name = 'NotificationCenterV1_11743600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- v1.1 columns on sys_user_notifications ----

    // status: ACTIVE (default) | SNOOZED
    await queryRunner.query(`
      ALTER TABLE "sys_user_notifications"
        ADD COLUMN IF NOT EXISTS "status" varchar(32) NOT NULL DEFAULT 'ACTIVE'
    `);

    // snoozeUntil: when the snoozed notification should re-appear
    await queryRunner.query(`
      ALTER TABLE "sys_user_notifications"
        ADD COLUMN IF NOT EXISTS "snooze_until" TIMESTAMP
    `);

    // remindAt: for personal reminders — when to activate the notification
    await queryRunner.query(`
      ALTER TABLE "sys_user_notifications"
        ADD COLUMN IF NOT EXISTS "remind_at" TIMESTAMP
    `);

    // Index for snooze cron: find snoozed notifications that should be reactivated
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_user_notifications_snooze_until"
      ON "sys_user_notifications" ("snooze_until")
      WHERE "snooze_until" IS NOT NULL AND "status" = 'SNOOZED'
    `);

    // Index for reminder cron: find pending reminders that should be activated
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_user_notifications_remind_at"
      ON "sys_user_notifications" ("remind_at")
      WHERE "remind_at" IS NOT NULL AND "status" = 'PENDING_REMINDER'
    `);

    // Composite index for unread count query optimization
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_user_notifications_unread"
      ON "sys_user_notifications" ("tenant_id", "user_id", "read_at")
      WHERE "read_at" IS NULL AND "status" = 'ACTIVE'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sys_user_notifications_unread"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sys_user_notifications_remind_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sys_user_notifications_snooze_until"`);

    await queryRunner.query(`
      ALTER TABLE "sys_user_notifications"
        DROP COLUMN IF EXISTS "remind_at",
        DROP COLUMN IF EXISTS "snooze_until",
        DROP COLUMN IF EXISTS "status"
    `);
  }
}
