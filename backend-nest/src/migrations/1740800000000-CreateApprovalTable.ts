import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateApprovalTable1740800000000 implements MigrationInterface {
  name = 'CreateApprovalTable1740800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'itsm_approval_state_enum') THEN
          CREATE TYPE "itsm_approval_state_enum" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itsm_approval" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "record_table" varchar(100) NOT NULL,
        "record_id" uuid NOT NULL,
        "state" "itsm_approval_state_enum" NOT NULL DEFAULT 'REQUESTED',
        "approver_user_id" uuid,
        "approver_role" varchar(100),
        "requested_by" uuid NOT NULL,
        "decided_at" timestamptz,
        "comment" text,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_itsm_approval" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itsm_approval_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_approval_tenant_record"
        ON "itsm_approval" ("tenant_id", "record_table", "record_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_approval_tenant_state"
        ON "itsm_approval" ("tenant_id", "state");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_approval_tenant_approver"
        ON "itsm_approval" ("tenant_id", "approver_user_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_approval_created_at"
        ON "itsm_approval" ("created_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "itsm_approval";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "itsm_approval_state_enum";`);
  }
}
