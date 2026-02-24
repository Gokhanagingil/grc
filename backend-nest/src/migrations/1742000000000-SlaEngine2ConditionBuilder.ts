import { MigrationInterface, QueryRunner } from 'typeorm';

export class SlaEngine2ConditionBuilder1742000000000 implements MigrationInterface {
  name = 'SlaEngine2ConditionBuilder1742000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── SLA Definitions: add SLA 2.0 columns ──────────────────────────
    await queryRunner.query(`
      ALTER TABLE "itsm_sla_definitions"
        ADD COLUMN IF NOT EXISTS "applies_to_record_type" varchar(50) NOT NULL DEFAULT 'INCIDENT',
        ADD COLUMN IF NOT EXISTS "condition_tree" jsonb,
        ADD COLUMN IF NOT EXISTS "response_time_seconds" int,
        ADD COLUMN IF NOT EXISTS "resolution_time_seconds" int,
        ADD COLUMN IF NOT EXISTS "priority_weight" int NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "stop_processing" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "effective_from" timestamptz,
        ADD COLUMN IF NOT EXISTS "effective_to" timestamptz,
        ADD COLUMN IF NOT EXISTS "version" int NOT NULL DEFAULT 1
    `);

    // Index for record-type + active filtering
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sla_def_record_type_active"
        ON "itsm_sla_definitions" ("tenant_id", "applies_to_record_type", "is_active")
        WHERE "is_deleted" = false
    `);

    // Index for precedence ordering
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sla_def_priority_weight"
        ON "itsm_sla_definitions" ("tenant_id", "priority_weight" DESC, "created_at" ASC)
        WHERE "is_deleted" = false AND "is_active" = true
    `);

    // ── SLA Instances: add SLA 2.0 columns ────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "itsm_sla_instances"
        ADD COLUMN IF NOT EXISTS "objective_type" varchar(50) NOT NULL DEFAULT 'RESOLUTION',
        ADD COLUMN IF NOT EXISTS "matched_policy_snapshot" jsonb,
        ADD COLUMN IF NOT EXISTS "match_reason" text
    `);

    // Index for objective-type dedup lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sla_inst_record_objective"
        ON "itsm_sla_instances" ("tenant_id", "record_type", "record_id", "objective_type")
        WHERE "is_deleted" = false
    `);

    // ── Back-fill existing definitions with v2 target columns ─────────
    // Copy target_seconds into resolution_time_seconds where metric is RESOLUTION_TIME
    await queryRunner.query(`
      UPDATE "itsm_sla_definitions"
      SET "resolution_time_seconds" = "target_seconds"
      WHERE "resolution_time_seconds" IS NULL
        AND "metric" = 'RESOLUTION_TIME'
    `);

    // Copy target_seconds into response_time_seconds where metric is RESPONSE_TIME
    await queryRunner.query(`
      UPDATE "itsm_sla_definitions"
      SET "response_time_seconds" = "target_seconds"
      WHERE "response_time_seconds" IS NULL
        AND "metric" = 'RESPONSE_TIME'
    `);

    // ── Back-fill existing definitions: convert legacy filters to condition_tree ──
    // This converts priorityFilter + serviceIdFilter into a v2 condition tree
    // Only for definitions that don't already have a condition_tree
    await queryRunner.query(`
      UPDATE "itsm_sla_definitions"
      SET "condition_tree" = (
        SELECT jsonb_build_object(
          'operator', 'AND',
          'children',
          COALESCE(
            (
              SELECT jsonb_agg(cond)
              FROM (
                SELECT jsonb_build_object(
                  'field', 'priority',
                  'operator', 'in',
                  'value', "priority_filter"
                ) AS cond
                WHERE "priority_filter" IS NOT NULL AND jsonb_array_length("priority_filter") > 0
                UNION ALL
                SELECT jsonb_build_object(
                  'field', 'serviceId',
                  'operator', 'is',
                  'value', "service_id_filter"::text
                ) AS cond
                WHERE "service_id_filter" IS NOT NULL
              ) sub
            ),
            '[]'::jsonb
          )
        )
      )
      WHERE "condition_tree" IS NULL
        AND (
          ("priority_filter" IS NOT NULL AND jsonb_array_length("priority_filter") > 0)
          OR "service_id_filter" IS NOT NULL
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sla_inst_record_objective"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sla_def_priority_weight"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sla_def_record_type_active"`,
    );

    await queryRunner.query(`
      ALTER TABLE "itsm_sla_instances"
        DROP COLUMN IF EXISTS "match_reason",
        DROP COLUMN IF EXISTS "matched_policy_snapshot",
        DROP COLUMN IF EXISTS "objective_type"
    `);

    await queryRunner.query(`
      ALTER TABLE "itsm_sla_definitions"
        DROP COLUMN IF EXISTS "version",
        DROP COLUMN IF EXISTS "effective_to",
        DROP COLUMN IF EXISTS "effective_from",
        DROP COLUMN IF EXISTS "stop_processing",
        DROP COLUMN IF EXISTS "priority_weight",
        DROP COLUMN IF EXISTS "resolution_time_seconds",
        DROP COLUMN IF EXISTS "response_time_seconds",
        DROP COLUMN IF EXISTS "condition_tree",
        DROP COLUMN IF EXISTS "applies_to_record_type"
    `);
  }
}
