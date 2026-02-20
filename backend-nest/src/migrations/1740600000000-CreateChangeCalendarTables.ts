import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChangeCalendarTables1740600000000
  implements MigrationInterface
{
  name = 'CreateChangeCalendarTables1740600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const calExists = (await queryRunner.query(
      `SELECT to_regclass('public.itsm_change_calendar_event') AS cls`,
    )) as { cls: string | null }[];

    if (!calExists[0]?.cls) {
      await queryRunner.query(`
        CREATE TABLE "itsm_change_calendar_event" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id" uuid NOT NULL,
          "change_id" uuid,
          "title" varchar(255) NOT NULL,
          "type" varchar(50) NOT NULL DEFAULT 'CHANGE',
          "status" varchar(50) NOT NULL DEFAULT 'SCHEDULED',
          "start_at" TIMESTAMPTZ NOT NULL,
          "end_at" TIMESTAMPTZ NOT NULL,
          "is_deleted" boolean NOT NULL DEFAULT false,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "created_by" uuid,
          "updated_by" uuid,
          CONSTRAINT "PK_itsm_change_calendar_event" PRIMARY KEY ("id"),
          CONSTRAINT "FK_itsm_cal_event_tenant" FOREIGN KEY ("tenant_id")
            REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_itsm_cal_event_change" FOREIGN KEY ("change_id")
            REFERENCES "itsm_changes"("id") ON DELETE SET NULL
        )
      `);

      await queryRunner.query(`
        CREATE INDEX "IDX_itsm_cal_event_tenant_start"
        ON "itsm_change_calendar_event" ("tenant_id", "start_at")
        WHERE "is_deleted" = false
      `);

      await queryRunner.query(`
        CREATE INDEX "IDX_itsm_cal_event_tenant_type"
        ON "itsm_change_calendar_event" ("tenant_id", "type")
        WHERE "is_deleted" = false
      `);

      await queryRunner.query(`
        CREATE INDEX "IDX_itsm_cal_event_change"
        ON "itsm_change_calendar_event" ("change_id")
        WHERE "change_id" IS NOT NULL
      `);
    }

    const freezeExists = (await queryRunner.query(
      `SELECT to_regclass('public.itsm_freeze_window') AS cls`,
    )) as { cls: string | null }[];

    if (!freezeExists[0]?.cls) {
      await queryRunner.query(`
        CREATE TABLE "itsm_freeze_window" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id" uuid NOT NULL,
          "name" varchar(255) NOT NULL,
          "description" text,
          "start_at" TIMESTAMPTZ NOT NULL,
          "end_at" TIMESTAMPTZ NOT NULL,
          "scope" varchar(50) NOT NULL DEFAULT 'GLOBAL',
          "scope_ref_id" uuid,
          "recurrence" varchar(50),
          "is_active" boolean NOT NULL DEFAULT true,
          "is_deleted" boolean NOT NULL DEFAULT false,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "created_by" uuid,
          "updated_by" uuid,
          CONSTRAINT "PK_itsm_freeze_window" PRIMARY KEY ("id"),
          CONSTRAINT "FK_itsm_freeze_tenant" FOREIGN KEY ("tenant_id")
            REFERENCES "nest_tenants"("id") ON DELETE CASCADE
        )
      `);

      await queryRunner.query(`
        CREATE INDEX "IDX_itsm_freeze_tenant_active"
        ON "itsm_freeze_window" ("tenant_id", "is_active")
        WHERE "is_deleted" = false
      `);

      await queryRunner.query(`
        CREATE INDEX "IDX_itsm_freeze_tenant_dates"
        ON "itsm_freeze_window" ("tenant_id", "start_at", "end_at")
        WHERE "is_deleted" = false AND "is_active" = true
      `);
    }

    const conflictExists = (await queryRunner.query(
      `SELECT to_regclass('public.itsm_calendar_conflict') AS cls`,
    )) as { cls: string | null }[];

    if (!conflictExists[0]?.cls) {
      await queryRunner.query(`
        CREATE TABLE "itsm_calendar_conflict" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id" uuid NOT NULL,
          "change_id" uuid NOT NULL,
          "conflict_type" varchar(50) NOT NULL,
          "conflicting_event_id" uuid,
          "conflicting_freeze_id" uuid,
          "severity" varchar(20) NOT NULL DEFAULT 'MEDIUM',
          "details" jsonb DEFAULT '{}',
          "is_deleted" boolean NOT NULL DEFAULT false,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "created_by" uuid,
          "updated_by" uuid,
          CONSTRAINT "PK_itsm_calendar_conflict" PRIMARY KEY ("id"),
          CONSTRAINT "FK_itsm_conflict_tenant" FOREIGN KEY ("tenant_id")
            REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_itsm_conflict_change" FOREIGN KEY ("change_id")
            REFERENCES "itsm_changes"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_itsm_conflict_event" FOREIGN KEY ("conflicting_event_id")
            REFERENCES "itsm_change_calendar_event"("id") ON DELETE SET NULL,
          CONSTRAINT "FK_itsm_conflict_freeze" FOREIGN KEY ("conflicting_freeze_id")
            REFERENCES "itsm_freeze_window"("id") ON DELETE SET NULL
        )
      `);

      await queryRunner.query(`
        CREATE INDEX "IDX_itsm_conflict_tenant_change"
        ON "itsm_calendar_conflict" ("tenant_id", "change_id")
        WHERE "is_deleted" = false
      `);

      await queryRunner.query(`
        CREATE INDEX "IDX_itsm_conflict_type"
        ON "itsm_calendar_conflict" ("tenant_id", "conflict_type")
        WHERE "is_deleted" = false
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itsm_conflict_type"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itsm_conflict_tenant_change"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_calendar_conflict"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itsm_freeze_tenant_dates"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itsm_freeze_tenant_active"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_freeze_window"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itsm_cal_event_change"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itsm_cal_event_tenant_type"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itsm_cal_event_tenant_start"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "itsm_change_calendar_event"`,
    );
  }
}
