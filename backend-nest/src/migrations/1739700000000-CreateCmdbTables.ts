import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCmdbTables1739700000000 implements MigrationInterface {
  name = 'CreateCmdbTables1739700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── cmdb_ci_class ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cmdb_ci_class" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "label" varchar(255) NOT NULL,
        "description" text,
        "icon" varchar(50),
        "parent_class_id" uuid,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" int NOT NULL DEFAULT 0,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_cmdb_ci_class" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "cmdb_ci_class" ADD CONSTRAINT "FK_cmdb_ci_class_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "cmdb_ci_class" ADD CONSTRAINT "FK_cmdb_ci_class_parent"
          FOREIGN KEY ("parent_class_id") REFERENCES "cmdb_ci_class"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cmdb_ci_class_tenant_name" ON "cmdb_ci_class" ("tenant_id", "name")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cmdb_ci_class_tenant_active" ON "cmdb_ci_class" ("tenant_id", "is_active")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cmdb_ci_class_tenant_created" ON "cmdb_ci_class" ("tenant_id", "created_at")`,
    );

    // ── cmdb_ci ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cmdb_ci" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "class_id" uuid NOT NULL,
        "lifecycle" varchar(50) NOT NULL DEFAULT 'installed',
        "environment" varchar(50) NOT NULL DEFAULT 'production',
        "category" varchar(100),
        "asset_tag" varchar(100),
        "serial_number" varchar(100),
        "ip_address" varchar(45),
        "dns_name" varchar(255),
        "managed_by" uuid,
        "owned_by" uuid,
        "attributes" jsonb,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_cmdb_ci" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "cmdb_ci" ADD CONSTRAINT "FK_cmdb_ci_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "cmdb_ci" ADD CONSTRAINT "FK_cmdb_ci_class"
          FOREIGN KEY ("class_id") REFERENCES "cmdb_ci_class"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cmdb_ci_tenant_name" ON "cmdb_ci" ("tenant_id", "name")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cmdb_ci_tenant_class" ON "cmdb_ci" ("tenant_id", "class_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cmdb_ci_tenant_lifecycle" ON "cmdb_ci" ("tenant_id", "lifecycle")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cmdb_ci_tenant_env" ON "cmdb_ci" ("tenant_id", "environment")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cmdb_ci_tenant_created" ON "cmdb_ci" ("tenant_id", "created_at")`,
    );

    // ── cmdb_ci_rel ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cmdb_ci_rel" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "source_ci_id" uuid NOT NULL,
        "target_ci_id" uuid NOT NULL,
        "type" varchar(50) NOT NULL,
        "notes" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_cmdb_ci_rel" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "cmdb_ci_rel" ADD CONSTRAINT "FK_cmdb_ci_rel_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "cmdb_ci_rel" ADD CONSTRAINT "FK_cmdb_ci_rel_source"
          FOREIGN KEY ("source_ci_id") REFERENCES "cmdb_ci"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "cmdb_ci_rel" ADD CONSTRAINT "FK_cmdb_ci_rel_target"
          FOREIGN KEY ("target_ci_id") REFERENCES "cmdb_ci"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cmdb_ci_rel_unique" ON "cmdb_ci_rel" ("tenant_id", "source_ci_id", "target_ci_id", "type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cmdb_ci_rel_tenant_source" ON "cmdb_ci_rel" ("tenant_id", "source_ci_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cmdb_ci_rel_tenant_target" ON "cmdb_ci_rel" ("tenant_id", "target_ci_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cmdb_ci_rel_tenant_type" ON "cmdb_ci_rel" ("tenant_id", "type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cmdb_ci_rel_tenant_created" ON "cmdb_ci_rel" ("tenant_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cmdb_ci_rel"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cmdb_ci"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cmdb_ci_class"`);
  }
}
