import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSysEventsTable1739200000000 implements MigrationInterface {
  name = 'CreateSysEventsTable1739200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sys_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "source" varchar(128) NOT NULL,
        "event_name" varchar(255) NOT NULL,
        "table_name" varchar(128),
        "record_id" uuid,
        "payload_json" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "status" varchar(32) NOT NULL DEFAULT 'PENDING',
        "actor_id" varchar(255),
        CONSTRAINT "PK_sys_events" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sys_events_tenant_created" ON "sys_events" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sys_events_event_status" ON "sys_events" ("event_name", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sys_events_table_record" ON "sys_events" ("table_name", "record_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sys_events_tenant" ON "sys_events" ("tenant_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sys_events_tenant"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_events_table_record"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_events_event_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_events_tenant_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "sys_events"`);
  }
}
