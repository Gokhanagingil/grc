import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CMDB Class Relationship Rules — Schema
 *
 * Creates the `cmdb_ci_class_relationship_rule` table which stores
 * class-level relationship allow-list rules with inheritance awareness.
 */
export class CmdbClassRelationshipRules1742500000000 implements MigrationInterface {
  name = 'CmdbClassRelationshipRules1742500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cmdb_ci_class_relationship_rule" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "source_class_id" uuid NOT NULL,
        "relationship_type_id" uuid NOT NULL,
        "target_class_id" uuid NOT NULL,
        "direction" varchar(20) NOT NULL DEFAULT 'OUTBOUND',
        "propagation_override" varchar(30),
        "propagation_weight" varchar(10),
        "is_active" boolean NOT NULL DEFAULT true,
        "is_system" boolean NOT NULL DEFAULT false,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_cmdb_ci_class_relationship_rule" PRIMARY KEY ("id"),
        CONSTRAINT "FK_cmdb_class_rel_rule_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_cmdb_class_rel_rule_source" FOREIGN KEY ("source_class_id")
          REFERENCES "cmdb_ci_class"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_cmdb_class_rel_rule_reltype" FOREIGN KEY ("relationship_type_id")
          REFERENCES "cmdb_relationship_type"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_cmdb_class_rel_rule_target" FOREIGN KEY ("target_class_id")
          REFERENCES "cmdb_ci_class"("id") ON DELETE CASCADE
      )
    `);

    // Unique: one rule per (tenant, source, relType, target) where not deleted
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cmdb_class_rel_rule_unique"
        ON "cmdb_ci_class_relationship_rule" ("tenant_id", "source_class_id", "relationship_type_id", "target_class_id")
        WHERE "is_deleted" = false
    `);

    // Indexes for common queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cmdb_class_rel_rule_source"
        ON "cmdb_ci_class_relationship_rule" ("tenant_id", "source_class_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cmdb_class_rel_rule_target"
        ON "cmdb_ci_class_relationship_rule" ("tenant_id", "target_class_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cmdb_class_rel_rule_reltype"
        ON "cmdb_ci_class_relationship_rule" ("tenant_id", "relationship_type_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cmdb_class_rel_rule_active"
        ON "cmdb_ci_class_relationship_rule" ("tenant_id", "is_active")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cmdb_class_rel_rule_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cmdb_class_rel_rule_reltype"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cmdb_class_rel_rule_target"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cmdb_class_rel_rule_source"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cmdb_class_rel_rule_unique"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "cmdb_ci_class_relationship_rule"`,
    );
  }
}
