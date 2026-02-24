import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCabMeetingTables1742200000000 implements MigrationInterface {
  name = 'CreateCabMeetingTables1742200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // CAB Meeting table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_cab_meeting" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "code" varchar(50) NOT NULL,
        "title" varchar(255) NOT NULL,
        "meeting_at" timestamptz NOT NULL,
        "end_at" timestamptz,
        "status" varchar(50) NOT NULL DEFAULT 'DRAFT',
        "chairperson_id" uuid,
        "notes" text,
        "summary" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_cab_meeting" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_cab_meeting_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_itsm_cab_meeting_chairperson" FOREIGN KEY ("chairperson_id")
          REFERENCES "nest_users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_cab_meeting_tenant_status"
        ON "itsm_cab_meeting" ("tenant_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_cab_meeting_tenant_meeting_at"
        ON "itsm_cab_meeting" ("tenant_id", "meeting_at")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_itsm_cab_meeting_tenant_code"
        ON "itsm_cab_meeting" ("tenant_id", "code")
    `);

    // CAB Agenda Item table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_cab_agenda_item" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "cab_meeting_id" uuid NOT NULL,
        "change_id" uuid NOT NULL,
        "order_index" int NOT NULL DEFAULT 0,
        "decision_status" varchar(50) NOT NULL DEFAULT 'PENDING',
        "decision_at" timestamptz,
        "decision_note" text,
        "conditions" text,
        "decision_by_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_cab_agenda_item" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_cab_agenda_item_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_itsm_cab_agenda_item_meeting" FOREIGN KEY ("cab_meeting_id")
          REFERENCES "itsm_cab_meeting"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_itsm_cab_agenda_item_change" FOREIGN KEY ("change_id")
          REFERENCES "itsm_changes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_itsm_cab_agenda_item_decision_by" FOREIGN KEY ("decision_by_id")
          REFERENCES "nest_users"("id") ON DELETE SET NULL,
        CONSTRAINT "UQ_cab_agenda_meeting_change" UNIQUE ("cab_meeting_id", "change_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_cab_agenda_item_tenant_meeting"
        ON "itsm_cab_agenda_item" ("tenant_id", "cab_meeting_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_cab_agenda_item_tenant_change"
        ON "itsm_cab_agenda_item" ("tenant_id", "change_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_cab_agenda_item_tenant_decision"
        ON "itsm_cab_agenda_item" ("tenant_id", "decision_status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "itsm_cab_agenda_item" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_cab_meeting" CASCADE`);
  }
}
