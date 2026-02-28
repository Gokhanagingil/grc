import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CreateCoreCompaniesTable Migration
 *
 * Creates the core_companies table as a shared dimension for ITSM, GRC, SLA, and Contracts.
 * Includes enum types for company_type and company_status.
 * Non-breaking: does not alter any existing tables.
 */
export class CreateCoreCompaniesTable1743000000000 implements MigrationInterface {
  name = 'CreateCoreCompaniesTable1743000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(
      `CREATE TYPE "core_company_type_enum" AS ENUM ('CUSTOMER', 'VENDOR', 'INTERNAL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "core_company_status_enum" AS ENUM ('ACTIVE', 'INACTIVE')`,
    );

    // Create core_companies table
    await queryRunner.query(`
      CREATE TABLE "core_companies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "type" "core_company_type_enum" NOT NULL DEFAULT 'CUSTOMER',
        "name" varchar(255) NOT NULL,
        "code" varchar(50),
        "status" "core_company_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "domain" varchar(255),
        "country" varchar(100),
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_core_companies" PRIMARY KEY ("id"),
        CONSTRAINT "FK_core_companies_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // Indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_core_companies_tenant_id" ON "core_companies" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_core_companies_tenant_name" ON "core_companies" ("tenant_id", "name")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_core_companies_tenant_code" ON "core_companies" ("tenant_id", "code") WHERE "code" IS NOT NULL AND "is_deleted" = false`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_core_companies_created_at" ON "core_companies" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_core_companies_updated_at" ON "core_companies" ("updated_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_core_companies_is_deleted" ON "core_companies" ("is_deleted")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "core_companies"`);
    await queryRunner.query(`DROP TYPE "core_company_status_enum"`);
    await queryRunner.query(`DROP TYPE "core_company_type_enum"`);
  }
}
