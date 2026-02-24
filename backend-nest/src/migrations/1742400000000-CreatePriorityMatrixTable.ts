import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePriorityMatrixTable1742400000000 implements MigrationInterface {
  name = 'CreatePriorityMatrixTable1742400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_priority_matrix" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "impact" varchar(20) NOT NULL,
        "urgency" varchar(20) NOT NULL,
        "priority" varchar(10) NOT NULL,
        "label" varchar(100),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_priority_matrix" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_priority_matrix_tenant_impact_urgency"
      ON "itsm_priority_matrix" ("tenant_id", "impact", "urgency")
      WHERE "is_deleted" = false
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_priority_matrix_tenant_id"
      ON "itsm_priority_matrix" ("tenant_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_priority_matrix_tenant_impact_urgency"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_priority_matrix_tenant_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_priority_matrix"`);
  }
}
