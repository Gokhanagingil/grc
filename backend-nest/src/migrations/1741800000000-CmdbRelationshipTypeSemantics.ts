import { MigrationInterface, QueryRunner } from 'typeorm';

export class CmdbRelationshipTypeSemantics1741800000000 implements MigrationInterface {
  name = 'CmdbRelationshipTypeSemantics1741800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the relationship type semantics catalog table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cmdb_relationship_type" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(50) NOT NULL,
        "label" varchar(100) NOT NULL,
        "description" text,
        "directionality" varchar(20) NOT NULL DEFAULT 'unidirectional',
        "inverse_label" varchar(100),
        "risk_propagation" varchar(20) NOT NULL DEFAULT 'forward',
        "allowed_source_classes" jsonb,
        "allowed_target_classes" jsonb,
        "allow_self_loop" boolean NOT NULL DEFAULT false,
        "allow_cycles" boolean NOT NULL DEFAULT true,
        "sort_order" int NOT NULL DEFAULT 0,
        "is_system" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_cmdb_relationship_type" PRIMARY KEY ("id"),
        CONSTRAINT "FK_cmdb_relationship_type_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE
      )
    `);

    // Unique constraint: one relationship type name per tenant
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cmdb_rel_type_tenant_name"
        ON "cmdb_relationship_type" ("tenant_id", "name")
        WHERE "is_deleted" = false
    `);

    // Index for active types
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cmdb_rel_type_tenant_active"
        ON "cmdb_relationship_type" ("tenant_id", "is_active")
    `);

    // Tenant index
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cmdb_rel_type_tenant"
        ON "cmdb_relationship_type" ("tenant_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cmdb_rel_type_tenant"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cmdb_rel_type_tenant_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cmdb_rel_type_tenant_name"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "cmdb_relationship_type"`);
  }
}
