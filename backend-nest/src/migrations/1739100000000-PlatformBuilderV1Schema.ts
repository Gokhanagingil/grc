import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlatformBuilderV1Schema1739100000000 implements MigrationInterface {
  name = 'PlatformBuilderV1Schema1739100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "sys_relationship_type_enum" AS ENUM ('one_to_one', 'one_to_many', 'many_to_many');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "sys_db_object"
        ADD COLUMN IF NOT EXISTS "extends" varchar(100),
        ADD COLUMN IF NOT EXISTS "is_core" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "display_field" varchar(100),
        ADD COLUMN IF NOT EXISTS "number_prefix" varchar(20)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_db_object_is_core"
      ON "sys_db_object" ("is_core")
    `);

    await queryRunner.query(`
      ALTER TABLE "sys_dictionary"
        ADD COLUMN IF NOT EXISTS "read_only" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "choice_table" varchar(100),
        ADD COLUMN IF NOT EXISTS "max_length" integer,
        ADD COLUMN IF NOT EXISTS "indexed" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sys_relationship" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(200) NOT NULL,
        "from_table" varchar(100) NOT NULL,
        "to_table" varchar(100) NOT NULL,
        "type" "sys_relationship_type_enum" NOT NULL DEFAULT 'one_to_many',
        "fk_column" varchar(100),
        "m2m_table" varchar(100),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_sys_relationship" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sys_relationship_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_sys_relationship_tenant_name" UNIQUE ("tenant_id", "name")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_relationship_tenant_id"
      ON "sys_relationship" ("tenant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_relationship_from_table"
      ON "sys_relationship" ("tenant_id", "from_table")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_relationship_to_table"
      ON "sys_relationship" ("tenant_id", "to_table")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_relationship_is_deleted"
      ON "sys_relationship" ("is_deleted")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sys_index" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "table_name" varchar(100) NOT NULL,
        "name" varchar(200) NOT NULL,
        "columns" jsonb NOT NULL DEFAULT '[]',
        "is_unique" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_sys_index" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sys_index_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_sys_index_tenant_name" UNIQUE ("tenant_id", "table_name", "name")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_index_tenant_id"
      ON "sys_index" ("tenant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_index_table_name"
      ON "sys_index" ("tenant_id", "table_name")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_index_is_deleted"
      ON "sys_index" ("is_deleted")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sys_index_is_deleted"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sys_index_table_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sys_index_tenant_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sys_index"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_relationship_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_relationship_to_table"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_relationship_from_table"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_relationship_tenant_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "sys_relationship"`);

    await queryRunner.query(`
      ALTER TABLE "sys_dictionary"
        DROP COLUMN IF EXISTS "read_only",
        DROP COLUMN IF EXISTS "choice_table",
        DROP COLUMN IF EXISTS "max_length",
        DROP COLUMN IF EXISTS "indexed"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sys_db_object_is_core"`);
    await queryRunner.query(`
      ALTER TABLE "sys_db_object"
        DROP COLUMN IF EXISTS "extends",
        DROP COLUMN IF EXISTS "is_core",
        DROP COLUMN IF EXISTS "display_field",
        DROP COLUMN IF EXISTS "number_prefix"
    `);

    await queryRunner.query(`DROP TYPE IF EXISTS "sys_relationship_type_enum"`);
  }
}
