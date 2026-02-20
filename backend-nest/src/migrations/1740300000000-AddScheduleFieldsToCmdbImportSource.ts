import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScheduleFieldsToCmdbImportSource1740300000000
  implements MigrationInterface
{
  name = 'AddScheduleFieldsToCmdbImportSource1740300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'cmdb_import_source'`,
    );
    const cols = new Set(
      (table as { column_name: string }[]).map((r) => r.column_name),
    );

    if (!cols.has('schedule_enabled')) {
      await queryRunner.query(
        `ALTER TABLE "cmdb_import_source" ADD COLUMN "schedule_enabled" boolean NOT NULL DEFAULT false`,
      );
    }

    if (!cols.has('cron_expr')) {
      await queryRunner.query(
        `ALTER TABLE "cmdb_import_source" ADD COLUMN "cron_expr" varchar(100)`,
      );
    }

    if (!cols.has('timezone')) {
      await queryRunner.query(
        `ALTER TABLE "cmdb_import_source" ADD COLUMN "timezone" varchar(64) NOT NULL DEFAULT 'UTC'`,
      );
    }

    if (!cols.has('max_runs_per_day')) {
      await queryRunner.query(
        `ALTER TABLE "cmdb_import_source" ADD COLUMN "max_runs_per_day" int NOT NULL DEFAULT 24`,
      );
    }

    if (!cols.has('dry_run_by_default')) {
      await queryRunner.query(
        `ALTER TABLE "cmdb_import_source" ADD COLUMN "dry_run_by_default" boolean NOT NULL DEFAULT true`,
      );
    }

    if (!cols.has('last_run_at')) {
      await queryRunner.query(
        `ALTER TABLE "cmdb_import_source" ADD COLUMN "last_run_at" TIMESTAMP`,
      );
    }

    if (!cols.has('next_run_at')) {
      await queryRunner.query(
        `ALTER TABLE "cmdb_import_source" ADD COLUMN "next_run_at" TIMESTAMP`,
      );
    }

    if (!cols.has('run_count_today')) {
      await queryRunner.query(
        `ALTER TABLE "cmdb_import_source" ADD COLUMN "run_count_today" int NOT NULL DEFAULT 0`,
      );
    }

    if (!cols.has('run_count_reset_date')) {
      await queryRunner.query(
        `ALTER TABLE "cmdb_import_source" ADD COLUMN "run_count_reset_date" date`,
      );
    }

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cmdb_import_source_schedule"
       ON "cmdb_import_source" ("tenant_id", "schedule_enabled", "next_run_at")
       WHERE "schedule_enabled" = true AND "is_deleted" = false`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cmdb_import_job_source_created"
       ON "cmdb_import_job" ("source_id", "created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cmdb_import_job_source_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cmdb_import_source_schedule"`,
    );

    const dropCols = [
      'schedule_enabled',
      'cron_expr',
      'timezone',
      'max_runs_per_day',
      'dry_run_by_default',
      'last_run_at',
      'next_run_at',
      'run_count_today',
      'run_count_reset_date',
    ];
    for (const col of dropCols) {
      await queryRunner.query(
        `ALTER TABLE "cmdb_import_source" DROP COLUMN IF EXISTS "${col}"`,
      );
    }
  }
}
