import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AddCustomerCompanyToItsmEntities Migration
 *
 * Adds optional customer_company_id FK column to itsm_services, itsm_incidents,
 * and itsm_changes tables, linking them to the core_companies shared dimension.
 * Includes tenant-aware composite indexes for efficient filtering.
 * Non-breaking: all new columns are nullable.
 */
export class AddCustomerCompanyToItsmEntities1743100000000 implements MigrationInterface {
  name = 'AddCustomerCompanyToItsmEntities1743100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── itsm_services ──────────────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "itsm_services" ADD COLUMN "customer_company_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "itsm_services" ADD CONSTRAINT "FK_itsm_services_customer_company"
       FOREIGN KEY ("customer_company_id") REFERENCES "core_companies"("id")
       ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_services_tenant_customer_company"
       ON "itsm_services" ("tenant_id", "customer_company_id")
       WHERE "customer_company_id" IS NOT NULL`,
    );

    // ── itsm_incidents ─────────────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "itsm_incidents" ADD COLUMN "customer_company_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "itsm_incidents" ADD CONSTRAINT "FK_itsm_incidents_customer_company"
       FOREIGN KEY ("customer_company_id") REFERENCES "core_companies"("id")
       ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_incidents_tenant_customer_company"
       ON "itsm_incidents" ("tenant_id", "customer_company_id")
       WHERE "customer_company_id" IS NOT NULL`,
    );

    // ── itsm_changes ───────────────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "itsm_changes" ADD COLUMN "customer_company_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "itsm_changes" ADD CONSTRAINT "FK_itsm_changes_customer_company"
       FOREIGN KEY ("customer_company_id") REFERENCES "core_companies"("id")
       ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itsm_changes_tenant_customer_company"
       ON "itsm_changes" ("tenant_id", "customer_company_id")
       WHERE "customer_company_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── itsm_changes ───────────────────────────────────────────────────
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itsm_changes_tenant_customer_company"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itsm_changes" DROP CONSTRAINT IF EXISTS "FK_itsm_changes_customer_company"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itsm_changes" DROP COLUMN IF EXISTS "customer_company_id"`,
    );

    // ── itsm_incidents ─────────────────────────────────────────────────
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itsm_incidents_tenant_customer_company"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itsm_incidents" DROP CONSTRAINT IF EXISTS "FK_itsm_incidents_customer_company"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itsm_incidents" DROP COLUMN IF EXISTS "customer_company_id"`,
    );

    // ── itsm_services ──────────────────────────────────────────────────
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itsm_services_tenant_customer_company"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itsm_services" DROP CONSTRAINT IF EXISTS "FK_itsm_services_customer_company"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itsm_services" DROP COLUMN IF EXISTS "customer_company_id"`,
    );
  }
}
