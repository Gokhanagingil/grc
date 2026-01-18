import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create List Views Tables Migration
 *
 * Creates the nest_list_views and nest_list_view_columns tables
 * for storing user/role/tenant/system list view configurations.
 */
export class CreateListViewsTables1736800000000 implements MigrationInterface {
  name = 'CreateListViewsTables1736800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for list view scope
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "nest_list_views_scope_enum" AS ENUM ('user', 'role', 'tenant', 'system');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create the list views table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "nest_list_views" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "table_name" varchar(100) NOT NULL,
        "name" varchar(100) NOT NULL,
        "scope" "nest_list_views_scope_enum" NOT NULL DEFAULT 'user',
        "owner_user_id" uuid,
        "role_id" uuid,
        "is_default" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_nest_list_views" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for list views
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nest_list_views_tenant_id" 
      ON "nest_list_views" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nest_list_views_tenant_table" 
      ON "nest_list_views" ("tenant_id", "table_name")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nest_list_views_tenant_table_scope_owner" 
      ON "nest_list_views" ("tenant_id", "table_name", "scope", "owner_user_id")
    `);

    // Add foreign key constraints for list views
    await queryRunner.query(`
      ALTER TABLE "nest_list_views" 
      ADD CONSTRAINT "FK_nest_list_views_tenant" 
      FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") 
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "nest_list_views" 
      ADD CONSTRAINT "FK_nest_list_views_owner_user" 
      FOREIGN KEY ("owner_user_id") REFERENCES "nest_users"("id") 
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // Create the list view columns table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "nest_list_view_columns" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "list_view_id" uuid NOT NULL,
        "column_name" varchar(100) NOT NULL,
        "order_index" int NOT NULL,
        "visible" boolean NOT NULL DEFAULT true,
        "width" int,
        "pinned" varchar(10),
        CONSTRAINT "PK_nest_list_view_columns" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for list view columns
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nest_list_view_columns_list_view_id" 
      ON "nest_list_view_columns" ("list_view_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nest_list_view_columns_list_view_order" 
      ON "nest_list_view_columns" ("list_view_id", "order_index")
    `);

    // Add foreign key constraint for list view columns
    await queryRunner.query(`
      ALTER TABLE "nest_list_view_columns" 
      ADD CONSTRAINT "FK_nest_list_view_columns_list_view" 
      FOREIGN KEY ("list_view_id") REFERENCES "nest_list_views"("id") 
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "nest_list_view_columns" DROP CONSTRAINT IF EXISTS "FK_nest_list_view_columns_list_view"
    `);

    await queryRunner.query(`
      ALTER TABLE "nest_list_views" DROP CONSTRAINT IF EXISTS "FK_nest_list_views_owner_user"
    `);

    await queryRunner.query(`
      ALTER TABLE "nest_list_views" DROP CONSTRAINT IF EXISTS "FK_nest_list_views_tenant"
    `);

    // Drop indexes for list view columns
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_nest_list_view_columns_list_view_order"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_nest_list_view_columns_list_view_id"`,
    );

    // Drop list view columns table
    await queryRunner.query(`DROP TABLE IF EXISTS "nest_list_view_columns"`);

    // Drop indexes for list views
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_nest_list_views_tenant_table_scope_owner"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_nest_list_views_tenant_table"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_nest_list_views_tenant_id"`,
    );

    // Drop list views table
    await queryRunner.query(`DROP TABLE IF EXISTS "nest_list_views"`);

    // Drop enum type
    await queryRunner.query(`DROP TYPE IF EXISTS "nest_list_views_scope_enum"`);
  }
}
