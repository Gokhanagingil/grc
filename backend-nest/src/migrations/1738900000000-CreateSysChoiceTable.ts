import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSysChoiceTable1738900000000 implements MigrationInterface {
  name = 'CreateSysChoiceTable1738900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sys_choice" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "table_name" varchar(100) NOT NULL,
        "field_name" varchar(100) NOT NULL,
        "value" varchar(100) NOT NULL,
        "label" varchar(255) NOT NULL,
        "sort_order" int NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "parent_value" varchar(100),
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_sys_choice" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "sys_choice" ADD CONSTRAINT "FK_sys_choice_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "sys_choice" ADD CONSTRAINT "UQ_sys_choice_tenant_table_field_value"
          UNIQUE ("tenant_id", "table_name", "field_name", "value");
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sys_choice_tenant_table_field" ON "sys_choice" ("tenant_id", "table_name", "field_name")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sys_choice_tenant_table" ON "sys_choice" ("tenant_id", "table_name")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sys_choice_tenant_active" ON "sys_choice" ("tenant_id", "is_active")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sys_choice_tenant_id" ON "sys_choice" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sys_choice_is_deleted" ON "sys_choice" ("is_deleted")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sys_choice"`);
  }
}
