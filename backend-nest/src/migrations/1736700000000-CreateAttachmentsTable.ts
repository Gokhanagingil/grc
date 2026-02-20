import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create Attachments Table Migration
 *
 * Creates the nest_attachments table for universal file attachment storage.
 * Supports multi-tenant isolation and soft delete pattern.
 */
export class CreateAttachmentsTable1736700000000 implements MigrationInterface {
  name = 'CreateAttachmentsTable1736700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "nest_attachments_storage_provider_enum" AS ENUM ('local', 's3');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "nest_attachments_status_enum" AS ENUM ('uploaded', 'scanned', 'blocked', 'deleted');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create the attachments table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "nest_attachments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "ref_table" varchar(100) NOT NULL,
        "ref_id" uuid NOT NULL,
        "file_name" varchar(255) NOT NULL,
        "content_type" varchar(100) NOT NULL,
        "size_bytes" bigint NOT NULL,
        "sha256" varchar(64) NOT NULL,
        "storage_provider" "nest_attachments_storage_provider_enum" NOT NULL DEFAULT 'local',
        "storage_key" varchar(500) NOT NULL,
        "status" "nest_attachments_status_enum" NOT NULL DEFAULT 'uploaded',
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_nest_attachments" PRIMARY KEY ("id")
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nest_attachments_tenant_id" 
      ON "nest_attachments" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nest_attachments_ref_table" 
      ON "nest_attachments" ("ref_table")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nest_attachments_ref_id" 
      ON "nest_attachments" ("ref_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nest_attachments_tenant_ref" 
      ON "nest_attachments" ("tenant_id", "ref_table", "ref_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_nest_attachments_tenant_storage_key" 
      ON "nest_attachments" ("tenant_id", "storage_key")
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "nest_attachments" 
      ADD CONSTRAINT "FK_nest_attachments_tenant" 
      FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") 
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "nest_attachments" 
      ADD CONSTRAINT "FK_nest_attachments_created_by" 
      FOREIGN KEY ("created_by") REFERENCES "nest_users"("id") 
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "nest_attachments" DROP CONSTRAINT IF EXISTS "FK_nest_attachments_created_by"
    `);

    await queryRunner.query(`
      ALTER TABLE "nest_attachments" DROP CONSTRAINT IF EXISTS "FK_nest_attachments_tenant"
    `);

    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_nest_attachments_tenant_storage_key"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_nest_attachments_tenant_ref"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_nest_attachments_ref_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_nest_attachments_ref_table"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_nest_attachments_tenant_id"`,
    );

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "nest_attachments"`);

    // Drop enum types
    await queryRunner.query(
      `DROP TYPE IF EXISTS "nest_attachments_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "nest_attachments_storage_provider_enum"`,
    );
  }
}
