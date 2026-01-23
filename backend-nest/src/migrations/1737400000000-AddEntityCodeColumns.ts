import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddEntityCodeColumns
 *
 * P1-2: Code/Number Standard
 *
 * Creates the tenant_sequences table for generating unique codes per tenant,
 * and adds code columns to entities that don't have them yet.
 *
 * Entities getting code columns:
 * - grc_risks (RISK-000001)
 * - grc_issues (FND-000001)
 * - grc_audits (AUD-000001)
 * - grc_requirements (REQ-000001) - already has referenceCode, adding generated code
 * - grc_evidence (EVD-000001)
 * - grc_process_violations (VIO-000001)
 * - grc_control_tests (TST-000001)
 * - grc_test_results (RES-000001)
 */
export class AddEntityCodeColumns1737400000000 implements MigrationInterface {
  name = 'AddEntityCodeColumns1737400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create tenant_sequences table for code generation
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_sequences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "sequence_key" varchar(50) NOT NULL,
        "next_value" bigint NOT NULL DEFAULT 1,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenant_sequences" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tenant_sequences_tenant" FOREIGN KEY ("tenant_id") 
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_tenant_sequences_tenant_key" UNIQUE ("tenant_id", "sequence_key")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tenant_sequences_tenant_id" 
      ON "tenant_sequences" ("tenant_id")
    `);

    // 2. Add code column to grc_risks
    await queryRunner.query(`
      ALTER TABLE "grc_risks" 
      ADD COLUMN IF NOT EXISTS "code" varchar(50)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_risks_tenant_code" 
      ON "grc_risks" ("tenant_id", "code") WHERE "code" IS NOT NULL
    `);

    // 3. Add code column to grc_issues
    await queryRunner.query(`
      ALTER TABLE "grc_issues" 
      ADD COLUMN IF NOT EXISTS "code" varchar(50)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_issues_tenant_code" 
      ON "grc_issues" ("tenant_id", "code") WHERE "code" IS NOT NULL
    `);

    // 4. Add code column to grc_audits
    await queryRunner.query(`
      ALTER TABLE "grc_audits" 
      ADD COLUMN IF NOT EXISTS "code" varchar(50)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_audits_tenant_code" 
      ON "grc_audits" ("tenant_id", "code") WHERE "code" IS NOT NULL
    `);

    // 5. Add code column to grc_requirements (separate from referenceCode)
    await queryRunner.query(`
      ALTER TABLE "grc_requirements" 
      ADD COLUMN IF NOT EXISTS "code" varchar(50)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_requirements_tenant_code" 
      ON "grc_requirements" ("tenant_id", "code") WHERE "code" IS NOT NULL
    `);

    // 6. Add code column to grc_evidence
    await queryRunner.query(`
      ALTER TABLE "grc_evidence" 
      ADD COLUMN IF NOT EXISTS "code" varchar(50)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_evidence_tenant_code" 
      ON "grc_evidence" ("tenant_id", "code") WHERE "code" IS NOT NULL
    `);

    // 7. Add code column to grc_process_violations
    await queryRunner.query(`
      ALTER TABLE "grc_process_violations" 
      ADD COLUMN IF NOT EXISTS "code" varchar(50)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_process_violations_tenant_code" 
      ON "grc_process_violations" ("tenant_id", "code") WHERE "code" IS NOT NULL
    `);

    // 8. Add code column to grc_control_tests
    await queryRunner.query(`
      ALTER TABLE "grc_control_tests" 
      ADD COLUMN IF NOT EXISTS "code" varchar(50)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_control_tests_tenant_code" 
      ON "grc_control_tests" ("tenant_id", "code") WHERE "code" IS NOT NULL
    `);

    // 9. Add code column to grc_test_results
    await queryRunner.query(`
      ALTER TABLE "grc_test_results" 
      ADD COLUMN IF NOT EXISTS "code" varchar(50)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grc_test_results_tenant_code" 
      ON "grc_test_results" ("tenant_id", "code") WHERE "code" IS NOT NULL
    `);

    // 10. Backfill existing records with codes
    // This is done in a deterministic way based on created_at order
    await this.backfillCodes(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes and columns in reverse order
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_test_results_tenant_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grc_test_results" DROP COLUMN IF EXISTS "code"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_control_tests_tenant_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grc_control_tests" DROP COLUMN IF EXISTS "code"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_process_violations_tenant_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grc_process_violations" DROP COLUMN IF EXISTS "code"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_evidence_tenant_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grc_evidence" DROP COLUMN IF EXISTS "code"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_requirements_tenant_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grc_requirements" DROP COLUMN IF EXISTS "code"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_audits_tenant_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grc_audits" DROP COLUMN IF EXISTS "code"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_grc_issues_tenant_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grc_issues" DROP COLUMN IF EXISTS "code"`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_grc_risks_tenant_code"`);
    await queryRunner.query(
      `ALTER TABLE "grc_risks" DROP COLUMN IF EXISTS "code"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tenant_sequences_tenant_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_sequences"`);
  }

  /**
   * Backfill existing records with generated codes
   * Uses deterministic ordering by created_at to ensure consistent results
   */
  private async backfillCodes(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      { table: 'grc_risks', prefix: 'RISK' },
      { table: 'grc_issues', prefix: 'FND' },
      { table: 'grc_audits', prefix: 'AUD' },
      { table: 'grc_requirements', prefix: 'REQ' },
      { table: 'grc_evidence', prefix: 'EVD' },
      { table: 'grc_process_violations', prefix: 'VIO' },
      { table: 'grc_control_tests', prefix: 'TST' },
      { table: 'grc_test_results', prefix: 'RES' },
    ];

    for (const { table, prefix } of tables) {
      // Get all distinct tenant_ids that have records without codes
      const tenants = (await queryRunner.query(`
        SELECT DISTINCT tenant_id FROM "${table}" WHERE code IS NULL
      `)) as Array<{ tenant_id: string }>;

      for (const { tenant_id } of tenants) {
        // Get all records without codes, ordered by created_at
        const records = (await queryRunner.query(
          `
          SELECT id FROM "${table}" 
          WHERE tenant_id = $1 AND code IS NULL 
          ORDER BY created_at ASC, id ASC
        `,
          [tenant_id],
        )) as Array<{ id: string }>;

        // Get or create sequence for this tenant/prefix
        const sequence = (await queryRunner.query(
          `
          SELECT next_value FROM "tenant_sequences" 
          WHERE tenant_id = $1 AND sequence_key = $2
        `,
          [tenant_id, prefix],
        )) as Array<{ next_value: string }>;

        let nextValue = 1;
        if (sequence.length > 0) {
          nextValue = parseInt(sequence[0].next_value, 10);
        } else {
          // Create sequence entry
          await queryRunner.query(
            `
            INSERT INTO "tenant_sequences" (tenant_id, sequence_key, next_value)
            VALUES ($1, $2, 1)
          `,
            [tenant_id, prefix],
          );
        }

        // Update each record with a generated code
        for (const record of records) {
          const code = `${prefix}-${nextValue.toString().padStart(6, '0')}`;
          await queryRunner.query(
            `
            UPDATE "${table}" SET code = $1 WHERE id = $2
          `,
            [code, record.id],
          );
          nextValue++;
        }

        // Update the sequence to the next value
        if (records.length > 0) {
          await queryRunner.query(
            `
            UPDATE "tenant_sequences" 
            SET next_value = $1, updated_at = now()
            WHERE tenant_id = $2 AND sequence_key = $3
          `,
            [nextValue, tenant_id, prefix],
          );
        }
      }
    }
  }
}
