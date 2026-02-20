import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantIdToPlatformHealth1741000000000 implements MigrationInterface {
  name = 'AddTenantIdToPlatformHealth1741000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform_health_runs"
      ADD COLUMN "tenant_id" uuid NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "platform_health_checks"
      ADD COLUMN "tenant_id" uuid NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_phr_tenant_id"
      ON "platform_health_runs" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_phc_tenant_id"
      ON "platform_health_checks" ("tenant_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_phc_tenant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_phr_tenant_id"`);
    await queryRunner.query(
      `ALTER TABLE "platform_health_checks" DROP COLUMN "tenant_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_health_runs" DROP COLUMN "tenant_id"`,
    );
  }
}
