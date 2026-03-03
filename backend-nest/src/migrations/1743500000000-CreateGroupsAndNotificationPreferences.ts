import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGroupsAndNotificationPreferences1743500000000
  implements MigrationInterface
{
  name = 'CreateGroupsAndNotificationPreferences1743500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- sys_groups ----
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sys_groups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sys_groups" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_sys_groups_tenant_name"
        ON "sys_groups" ("tenant_id", "name")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_groups_tenant"
        ON "sys_groups" ("tenant_id")
    `);

    // ---- sys_group_memberships ----
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sys_group_memberships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "group_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sys_group_memberships" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_sys_group_memberships_tenant_group_user"
        ON "sys_group_memberships" ("tenant_id", "group_id", "user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_group_memberships_tenant"
        ON "sys_group_memberships" ("tenant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_group_memberships_group"
        ON "sys_group_memberships" ("group_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_group_memberships_user"
        ON "sys_group_memberships" ("user_id")
    `);

    // ---- sys_notification_preferences ----
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sys_notification_preferences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "notify_on_assignment" boolean NOT NULL DEFAULT true,
        "notify_on_due_date" boolean NOT NULL DEFAULT true,
        "notify_on_group_assignment" boolean NOT NULL DEFAULT false,
        "notify_on_system" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sys_notification_preferences" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_sys_notification_preferences_tenant_user"
        ON "sys_notification_preferences" ("tenant_id", "user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sys_notification_preferences"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sys_group_memberships"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sys_groups"`);
  }
}
