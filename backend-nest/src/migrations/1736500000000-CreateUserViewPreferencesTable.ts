import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserViewPreferencesTable1736500000000 implements MigrationInterface {
  name = 'CreateUserViewPreferencesTable1736500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create user_view_preferences table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_view_preferences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "table_name" character varying(100) NOT NULL,
        "visible_columns" jsonb NOT NULL DEFAULT '[]',
        "column_order" jsonb NOT NULL DEFAULT '[]',
        "column_widths" jsonb,
        "sort_field" character varying(100),
        "sort_direction" character varying(4),
        "filters" jsonb,
        "page_size" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_view_preferences" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_view_preferences_tenant_user_table" UNIQUE ("tenant_id", "user_id", "table_name")
      )
    `);

    // Create indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_view_preferences_tenant" ON "user_view_preferences" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_view_preferences_user" ON "user_view_preferences" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_view_preferences_tenant_user" ON "user_view_preferences" ("tenant_id", "user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_view_preferences_tenant_table" ON "user_view_preferences" ("tenant_id", "table_name")`,
    );

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "user_view_preferences" 
      ADD CONSTRAINT "FK_user_view_preferences_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "user_view_preferences" 
      ADD CONSTRAINT "FK_user_view_preferences_user" FOREIGN KEY ("user_id") REFERENCES "nest_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "user_view_preferences" DROP CONSTRAINT IF EXISTS "FK_user_view_preferences_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_view_preferences" DROP CONSTRAINT IF EXISTS "FK_user_view_preferences_tenant"`,
    );

    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_user_view_preferences_tenant_table"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_user_view_preferences_tenant_user"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_user_view_preferences_user"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_user_view_preferences_tenant"`,
    );

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "user_view_preferences"`);
  }
}
