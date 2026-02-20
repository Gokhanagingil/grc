import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlatformHealthTables1740900000000
  implements MigrationInterface
{
  name = 'CreatePlatformHealthTables1740900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform_health_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "suite" varchar(16) NOT NULL DEFAULT 'TIER1',
        "status" varchar(16) NOT NULL DEFAULT 'RUNNING',
        "triggered_by" varchar(64) NOT NULL DEFAULT 'ci',
        "total_checks" int NOT NULL DEFAULT 0,
        "passed_checks" int NOT NULL DEFAULT 0,
        "failed_checks" int NOT NULL DEFAULT 0,
        "skipped_checks" int NOT NULL DEFAULT 0,
        "duration_ms" int NOT NULL DEFAULT 0,
        "git_sha" varchar(64),
        "git_ref" varchar(128),
        "started_at" TIMESTAMP NOT NULL,
        "finished_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_health_runs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_phr_suite_started"
      ON "platform_health_runs" ("suite", "started_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_phr_status_started"
      ON "platform_health_runs" ("status", "started_at")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform_health_checks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "run_id" uuid NOT NULL,
        "module" varchar(64) NOT NULL,
        "check_name" varchar(128) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'PASSED',
        "duration_ms" int NOT NULL DEFAULT 0,
        "http_status" int,
        "error_message" text,
        "request_url" text,
        "response_snippet" jsonb,
        CONSTRAINT "PK_platform_health_checks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_phc_run" FOREIGN KEY ("run_id")
          REFERENCES "platform_health_runs"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_phc_run_module"
      ON "platform_health_checks" ("run_id", "module")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_phc_run_module"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "platform_health_checks"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_phr_status_started"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_phr_suite_started"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "platform_health_runs"`,
    );
  }
}
