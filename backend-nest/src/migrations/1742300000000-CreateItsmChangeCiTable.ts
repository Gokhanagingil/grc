import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateItsmChangeCiTable1742300000000 implements MigrationInterface {
  name = 'CreateItsmChangeCiTable1742300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_change_ci" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "change_id" uuid NOT NULL,
        "ci_id" uuid NOT NULL,
        "relationship_type" varchar(50) NOT NULL,
        "impact_scope" varchar(50),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_change_ci" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_change_ci"
          ADD CONSTRAINT "FK_itsm_change_ci_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id")
          ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_change_ci"
          ADD CONSTRAINT "FK_itsm_change_ci_change"
          FOREIGN KEY ("change_id") REFERENCES "itsm_changes"("id")
          ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_change_ci"
          ADD CONSTRAINT "FK_itsm_change_ci_ci"
          FOREIGN KEY ("ci_id") REFERENCES "cmdb_ci"("id")
          ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_itsm_change_ci_tenant_change_ci_rel"
        ON "itsm_change_ci" ("tenant_id", "change_id", "ci_id", "relationship_type")
        WHERE "is_deleted" = false
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_change_ci_tenant_change"
        ON "itsm_change_ci" ("tenant_id", "change_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_change_ci_tenant_ci"
        ON "itsm_change_ci" ("tenant_id", "ci_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_change_ci_tenant_created"
        ON "itsm_change_ci" ("tenant_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itsm_change_ci_tenant_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itsm_change_ci_tenant_ci"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itsm_change_ci_tenant_change"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_itsm_change_ci_tenant_change_ci_rel"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_change_ci"`);
  }
}
