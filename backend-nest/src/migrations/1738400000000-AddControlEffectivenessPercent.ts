import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add Control Effectiveness Percent Fields
 *
 * Adds numeric effectiveness percentage fields for more granular control
 * effectiveness configuration:
 *
 * 1. grc_controls.effectiveness_percent (int, nullable, default 50)
 *    - Global effectiveness percentage for a control (0-100)
 *    - Used as default when calculating residual risk reduction
 *
 * 2. grc_risk_controls.override_effectiveness_percent (int, nullable)
 *    - Per-risk override for effectiveness percentage
 *    - When set, takes precedence over control's global effectiveness
 *    - When null, uses control's global effectiveness_percent
 *
 * Effective Effectiveness = override_effectiveness_percent ?? control.effectiveness_percent
 */
export class AddControlEffectivenessPercent1738400000000 implements MigrationInterface {
  name = 'AddControlEffectivenessPercent1738400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add effectiveness_percent to grc_controls with default 50
    await queryRunner.query(`
      ALTER TABLE "grc_controls"
      ADD COLUMN IF NOT EXISTS "effectiveness_percent" integer DEFAULT 50
    `);

    // Add override_effectiveness_percent to grc_risk_controls (nullable, no default)
    await queryRunner.query(`
      ALTER TABLE "grc_risk_controls"
      ADD COLUMN IF NOT EXISTS "override_effectiveness_percent" integer
    `);

    // Add check constraint for grc_controls.effectiveness_percent (0-100)
    await queryRunner.query(`
      ALTER TABLE "grc_controls"
      ADD CONSTRAINT "CHK_grc_controls_effectiveness_percent_range"
      CHECK ("effectiveness_percent" IS NULL OR ("effectiveness_percent" >= 0 AND "effectiveness_percent" <= 100))
    `);

    // Add check constraint for grc_risk_controls.override_effectiveness_percent (0-100)
    await queryRunner.query(`
      ALTER TABLE "grc_risk_controls"
      ADD CONSTRAINT "CHK_grc_risk_controls_override_effectiveness_percent_range"
      CHECK ("override_effectiveness_percent" IS NULL OR ("override_effectiveness_percent" >= 0 AND "override_effectiveness_percent" <= 100))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove check constraints
    await queryRunner.query(`
      ALTER TABLE "grc_risk_controls"
      DROP CONSTRAINT IF EXISTS "CHK_grc_risk_controls_override_effectiveness_percent_range"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_controls"
      DROP CONSTRAINT IF EXISTS "CHK_grc_controls_effectiveness_percent_range"
    `);

    // Remove columns
    await queryRunner.query(`
      ALTER TABLE "grc_risk_controls"
      DROP COLUMN IF EXISTS "override_effectiveness_percent"
    `);

    await queryRunner.query(`
      ALTER TABLE "grc_controls"
      DROP COLUMN IF EXISTS "effectiveness_percent"
    `);
  }
}
