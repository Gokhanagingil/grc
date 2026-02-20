import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCmdbImportMappingTable1740400000000
  implements MigrationInterface
{
  name = 'CreateCmdbImportMappingTable1740400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = (await queryRunner.query(
      `SELECT to_regclass('public.cmdb_import_mapping') AS cls`,
    )) as { cls: string | null }[];

    if (exists[0]?.cls) {
      return;
    }

    await queryRunner.query(`
      CREATE TABLE "cmdb_import_mapping" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "source_id" uuid NOT NULL,
        "target_class_id" uuid,
        "connector_type" varchar(50) NOT NULL DEFAULT 'JSON_ROWS',
        "field_map" jsonb NOT NULL DEFAULT '{}',
        "key_fields" jsonb NOT NULL DEFAULT '[]',
        "transforms" jsonb NOT NULL DEFAULT '[]',
        "connector_config" jsonb NOT NULL DEFAULT '{}',
        "is_deleted" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_cmdb_import_mapping" PRIMARY KEY ("id"),
        CONSTRAINT "FK_cmdb_import_mapping_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_cmdb_import_mapping_source" FOREIGN KEY ("source_id")
          REFERENCES "cmdb_import_source"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_cmdb_import_mapping_tenant_source"
      ON "cmdb_import_mapping" ("tenant_id", "source_id")
      WHERE "is_deleted" = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cmdb_import_mapping_tenant_source"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "cmdb_import_mapping"`);
  }
}
