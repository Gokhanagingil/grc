import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: CreatePlatformBuilderTables
 *
 * Creates the tables required for the Platform Builder v0 feature:
 * - sys_db_object: Table definitions (metadata dictionary)
 * - sys_dictionary: Field definitions for dynamic tables
 * - dynamic_records: JSONB storage for dynamic table records
 *
 * This enables Admin users to define custom tables and fields,
 * with records stored in JSONB format for flexibility.
 */
export class CreatePlatformBuilderTables1737300000000 implements MigrationInterface {
  name = 'CreatePlatformBuilderTables1737300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure uuid extension is available
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    // Create sys_dictionary_field_type enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "sys_dictionary_field_type_enum" AS ENUM (
          'string', 'text', 'integer', 'decimal', 'boolean', 
          'date', 'datetime', 'choice', 'reference'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create sys_db_object table (table definitions)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sys_db_object" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "label" varchar(255) NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_sys_db_object" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sys_db_object_tenant" FOREIGN KEY ("tenant_id") 
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_sys_db_object_tenant_name" UNIQUE ("tenant_id", "name")
      )
    `);

    // Create indexes for sys_db_object
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_db_object_tenant_id" 
      ON "sys_db_object" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_db_object_is_deleted" 
      ON "sys_db_object" ("is_deleted")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_db_object_is_active" 
      ON "sys_db_object" ("is_active")
    `);

    // Create sys_dictionary table (field definitions)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sys_dictionary" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "table_name" varchar(100) NOT NULL,
        "field_name" varchar(100) NOT NULL,
        "label" varchar(255) NOT NULL,
        "type" "sys_dictionary_field_type_enum" NOT NULL DEFAULT 'string',
        "is_required" boolean NOT NULL DEFAULT false,
        "is_unique" boolean NOT NULL DEFAULT false,
        "reference_table" varchar(100),
        "choice_options" jsonb,
        "default_value" varchar(500),
        "field_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_sys_dictionary" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sys_dictionary_tenant" FOREIGN KEY ("tenant_id") 
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_sys_dictionary_tenant_table_field" 
          UNIQUE ("tenant_id", "table_name", "field_name")
      )
    `);

    // Create indexes for sys_dictionary
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_dictionary_tenant_id" 
      ON "sys_dictionary" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_dictionary_table_name" 
      ON "sys_dictionary" ("tenant_id", "table_name")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_dictionary_is_deleted" 
      ON "sys_dictionary" ("is_deleted")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_dictionary_is_active" 
      ON "sys_dictionary" ("is_active")
    `);

    // Create dynamic_records table (JSONB storage for dynamic table records)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dynamic_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "table_name" varchar(100) NOT NULL,
        "record_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "data" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_dynamic_records" PRIMARY KEY ("id"),
        CONSTRAINT "FK_dynamic_records_tenant" FOREIGN KEY ("tenant_id") 
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for dynamic_records
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dynamic_records_tenant_id" 
      ON "dynamic_records" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dynamic_records_tenant_table" 
      ON "dynamic_records" ("tenant_id", "table_name")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dynamic_records_record_id" 
      ON "dynamic_records" ("record_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dynamic_records_is_deleted" 
      ON "dynamic_records" ("is_deleted")
    `);

    // Create GIN index on data JSONB column for efficient querying
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dynamic_records_data_gin" 
      ON "dynamic_records" USING GIN ("data")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes for dynamic_records
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_dynamic_records_data_gin"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_dynamic_records_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_dynamic_records_record_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_dynamic_records_tenant_table"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_dynamic_records_tenant_id"`,
    );

    // Drop dynamic_records table
    await queryRunner.query(`DROP TABLE IF EXISTS "dynamic_records"`);

    // Drop indexes for sys_dictionary
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_dictionary_is_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_dictionary_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_dictionary_table_name"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_dictionary_tenant_id"`,
    );

    // Drop sys_dictionary table
    await queryRunner.query(`DROP TABLE IF EXISTS "sys_dictionary"`);

    // Drop indexes for sys_db_object
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_db_object_is_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_db_object_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_sys_db_object_tenant_id"`,
    );

    // Drop sys_db_object table
    await queryRunner.query(`DROP TABLE IF EXISTS "sys_db_object"`);

    // Drop enum type
    await queryRunner.query(
      `DROP TYPE IF EXISTS "sys_dictionary_field_type_enum"`,
    );
  }
}
