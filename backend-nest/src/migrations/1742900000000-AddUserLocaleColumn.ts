import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add locale column to nest_users table for i18n Phase 1.
 * Stores IETF locale codes (e.g., 'en-US', 'tr-TR').
 * NULL means "use system default (en-US)".
 */
export class AddUserLocaleColumn1742900000000 implements MigrationInterface {
  name = 'AddUserLocaleColumn1742900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "nest_users" ADD COLUMN IF NOT EXISTS "locale" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "nest_users" DROP COLUMN IF EXISTS "locale"`,
    );
  }
}
