import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKnownErrorTable1741300000000 implements MigrationInterface {
  name = 'CreateKnownErrorTable1741300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums
    await queryRunner.query(`
      CREATE TYPE "itsm_known_error_state_enum" AS ENUM (
        'DRAFT', 'PUBLISHED', 'RETIRED'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "itsm_known_error_fix_status_enum" AS ENUM (
        'NONE', 'WORKAROUND_AVAILABLE', 'FIX_IN_PROGRESS', 'FIX_DEPLOYED'
      )
    `);

    // Create itsm_known_errors table
    await queryRunner.query(`
      CREATE TABLE "itsm_known_errors" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "title" varchar(255) NOT NULL,
        "symptoms" text,
        "root_cause" text,
        "workaround" text,
        "permanent_fix_status" "itsm_known_error_fix_status_enum" NOT NULL DEFAULT 'NONE',
        "article_ref" varchar(255),
        "state" "itsm_known_error_state_enum" NOT NULL DEFAULT 'DRAFT',
        "published_at" timestamptz,
        "problem_id" uuid,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_known_errors" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_known_errors_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_itsm_known_errors_problem" FOREIGN KEY ("problem_id") REFERENCES "itsm_problems"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    // Indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_known_errors_tenant_problem" ON "itsm_known_errors" ("tenant_id", "problem_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_known_errors_tenant_state" ON "itsm_known_errors" ("tenant_id", "state")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_known_errors_tenant_fix_status" ON "itsm_known_errors" ("tenant_id", "permanent_fix_status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_known_errors_tenant_created" ON "itsm_known_errors" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_known_errors_is_deleted" ON "itsm_known_errors" ("is_deleted")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_known_errors"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "itsm_known_error_fix_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "itsm_known_error_state_enum"`,
    );
  }
}
