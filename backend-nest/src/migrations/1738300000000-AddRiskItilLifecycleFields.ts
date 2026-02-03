import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRiskItilLifecycleFields1738300000000 implements MigrationInterface {
  name = 'AddRiskItilLifecycleFields1738300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add ITIL-aligned lifecycle fields to grc_risks table
    // These fields support risk review scheduling and acceptance audit trail

    // Next review date - when the risk should be reviewed next
    await queryRunner.query(`
      ALTER TABLE "grc_risks"
      ADD COLUMN IF NOT EXISTS "next_review_at" date
    `);

    // Review interval in days - how often the risk should be reviewed
    await queryRunner.query(`
      ALTER TABLE "grc_risks"
      ADD COLUMN IF NOT EXISTS "review_interval_days" integer
    `);

    // Acceptance reason - required when treatment_strategy = 'accept'
    await queryRunner.query(`
      ALTER TABLE "grc_risks"
      ADD COLUMN IF NOT EXISTS "acceptance_reason" text
    `);

    // Accepted by user - who approved the risk acceptance
    await queryRunner.query(`
      ALTER TABLE "grc_risks"
      ADD COLUMN IF NOT EXISTS "accepted_by_user_id" uuid
    `);

    // Accepted at timestamp - when the risk was accepted
    await queryRunner.query(`
      ALTER TABLE "grc_risks"
      ADD COLUMN IF NOT EXISTS "accepted_at" timestamptz
    `);

    // Add foreign key constraint for accepted_by_user_id
    await queryRunner.query(`
      ALTER TABLE "grc_risks"
      ADD CONSTRAINT "FK_grc_risks_accepted_by_user"
      FOREIGN KEY ("accepted_by_user_id")
      REFERENCES "nest_users"("id")
      ON DELETE SET NULL
    `);

    // Add index for next_review_at to support overdue review queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_grc_risks_tenant_next_review"
      ON "grc_risks" ("tenant_id", "next_review_at")
      WHERE "next_review_at" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_grc_risks_tenant_next_review"
    `);

    // Remove foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "grc_risks"
      DROP CONSTRAINT IF EXISTS "FK_grc_risks_accepted_by_user"
    `);

    // Remove columns
    await queryRunner.query(`
      ALTER TABLE "grc_risks"
      DROP COLUMN IF EXISTS "accepted_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks"
      DROP COLUMN IF EXISTS "accepted_by_user_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks"
      DROP COLUMN IF EXISTS "acceptance_reason"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks"
      DROP COLUMN IF EXISTS "review_interval_days"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_risks"
      DROP COLUMN IF EXISTS "next_review_at"
    `);
  }
}
