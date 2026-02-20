import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCmdbHealthTables1740500000000 implements MigrationInterface {
  name = 'CreateCmdbHealthTables1740500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const ruleExists = (await queryRunner.query(
      `SELECT to_regclass('public.cmdb_health_rule') AS cls`,
    )) as { cls: string | null }[];

    if (!ruleExists[0]?.cls) {
      await queryRunner.query(`
        CREATE TABLE "cmdb_health_rule" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id" uuid NOT NULL,
          "name" varchar(255) NOT NULL,
          "description" text,
          "severity" varchar(20) NOT NULL DEFAULT 'MEDIUM',
          "condition" jsonb NOT NULL DEFAULT '{}',
          "enabled" boolean NOT NULL DEFAULT true,
          "is_deleted" boolean NOT NULL DEFAULT false,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
          "created_by" uuid,
          "updated_by" uuid,
          CONSTRAINT "PK_cmdb_health_rule" PRIMARY KEY ("id"),
          CONSTRAINT "FK_cmdb_health_rule_tenant" FOREIGN KEY ("tenant_id")
            REFERENCES "nest_tenants"("id") ON DELETE CASCADE
        )
      `);

      await queryRunner.query(`
        CREATE INDEX "IDX_cmdb_health_rule_tenant_enabled"
        ON "cmdb_health_rule" ("tenant_id", "enabled")
        WHERE "is_deleted" = false
      `);
    }

    const findingExists = (await queryRunner.query(
      `SELECT to_regclass('public.cmdb_health_finding') AS cls`,
    )) as { cls: string | null }[];

    if (!findingExists[0]?.cls) {
      await queryRunner.query(`
        CREATE TABLE "cmdb_health_finding" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id" uuid NOT NULL,
          "rule_id" uuid NOT NULL,
          "ci_id" uuid NOT NULL,
          "status" varchar(20) NOT NULL DEFAULT 'OPEN',
          "details" jsonb NOT NULL DEFAULT '{}',
          "first_seen_at" TIMESTAMP NOT NULL DEFAULT now(),
          "last_seen_at" TIMESTAMP NOT NULL DEFAULT now(),
          "waived_by" uuid,
          "waived_at" TIMESTAMP,
          "waive_reason" text,
          "is_deleted" boolean NOT NULL DEFAULT false,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
          "created_by" uuid,
          "updated_by" uuid,
          CONSTRAINT "PK_cmdb_health_finding" PRIMARY KEY ("id"),
          CONSTRAINT "FK_cmdb_health_finding_tenant" FOREIGN KEY ("tenant_id")
            REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_cmdb_health_finding_rule" FOREIGN KEY ("rule_id")
            REFERENCES "cmdb_health_rule"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_cmdb_health_finding_ci" FOREIGN KEY ("ci_id")
            REFERENCES "cmdb_ci"("id") ON DELETE CASCADE
        )
      `);

      await queryRunner.query(`
        CREATE INDEX "IDX_cmdb_health_finding_tenant_status"
        ON "cmdb_health_finding" ("tenant_id", "status")
        WHERE "is_deleted" = false
      `);

      await queryRunner.query(`
        CREATE INDEX "IDX_cmdb_health_finding_rule_ci"
        ON "cmdb_health_finding" ("rule_id", "ci_id")
      `);
    }

    const snapshotExists = (await queryRunner.query(
      `SELECT to_regclass('public.cmdb_quality_snapshot') AS cls`,
    )) as { cls: string | null }[];

    if (!snapshotExists[0]?.cls) {
      await queryRunner.query(`
        CREATE TABLE "cmdb_quality_snapshot" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenant_id" uuid NOT NULL,
          "score" numeric(5,2) NOT NULL DEFAULT 0,
          "total_cis" int NOT NULL DEFAULT 0,
          "total_findings" int NOT NULL DEFAULT 0,
          "open_findings" int NOT NULL DEFAULT 0,
          "waived_findings" int NOT NULL DEFAULT 0,
          "resolved_findings" int NOT NULL DEFAULT 0,
          "breakdown" jsonb NOT NULL DEFAULT '{}',
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_cmdb_quality_snapshot" PRIMARY KEY ("id"),
          CONSTRAINT "FK_cmdb_quality_snapshot_tenant" FOREIGN KEY ("tenant_id")
            REFERENCES "nest_tenants"("id") ON DELETE CASCADE
        )
      `);

      await queryRunner.query(`
        CREATE INDEX "IDX_cmdb_quality_snapshot_tenant_created"
        ON "cmdb_quality_snapshot" ("tenant_id", "created_at" DESC)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cmdb_quality_snapshot_tenant_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "cmdb_quality_snapshot"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cmdb_health_finding_rule_ci"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cmdb_health_finding_tenant_status"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "cmdb_health_finding"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cmdb_health_rule_tenant_enabled"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "cmdb_health_rule"`);
  }
}
