import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEvidenceDueDateAndIndexes1736900000000 implements MigrationInterface {
  name = 'AddEvidenceDueDateAndIndexes1736900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add due_date column to grc_evidence table
    await queryRunner.query(`
      ALTER TABLE "grc_evidence" 
      ADD COLUMN IF NOT EXISTS "due_date" date
    `);

    // Create indexes for better query performance
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_evidence_tenant_updated_at" ON "grc_evidence" ("tenant_id", "updated_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_evidence_tenant_name" ON "grc_evidence" ("tenant_id", "name")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grc_evidence_tenant_due_date" ON "grc_evidence" ("tenant_id", "due_date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_evidence_tenant_due_date"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_evidence_tenant_name"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_evidence_tenant_updated_at"`,
    );

    // Drop due_date column
    await queryRunner.query(`
      ALTER TABLE "grc_evidence" 
      DROP COLUMN IF EXISTS "due_date"
    `);
  }
}
