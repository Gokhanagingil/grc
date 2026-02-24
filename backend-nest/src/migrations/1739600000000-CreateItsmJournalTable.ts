import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateItsmJournalTable1739600000000 implements MigrationInterface {
  name = 'CreateItsmJournalTable1739600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_journal" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "table_name" varchar(100) NOT NULL,
        "record_id" uuid NOT NULL,
        "type" varchar(50) NOT NULL DEFAULT 'comment',
        "message" text NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_journal" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_journal" ADD CONSTRAINT "FK_itsm_journal_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_journal" ADD CONSTRAINT "FK_itsm_journal_created_by"
          FOREIGN KEY ("created_by") REFERENCES "nest_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_journal" ADD CONSTRAINT "FK_itsm_journal_updated_by"
          FOREIGN KEY ("updated_by") REFERENCES "nest_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_journal_tenant_id" ON "itsm_journal" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_journal_tenant_table_record" ON "itsm_journal" ("tenant_id", "table_name", "record_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_journal_tenant_table_record_type" ON "itsm_journal" ("tenant_id", "table_name", "record_id", "type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_journal_tenant_created_at" ON "itsm_journal" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itsm_journal_is_deleted" ON "itsm_journal" ("is_deleted")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_journal"`);
  }
}
