import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDataPolicyColumns1739100000000 implements MigrationInterface {
  name = 'AddDataPolicyColumns1739100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sys_dictionary"
      ADD COLUMN IF NOT EXISTS "read_only" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "sys_dictionary"
      ADD COLUMN IF NOT EXISTS "max_length" integer
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sys_dictionary"
      DROP COLUMN IF EXISTS "max_length"
    `);

    await queryRunner.query(`
      ALTER TABLE "sys_dictionary"
      DROP COLUMN IF EXISTS "read_only"
    `);
  }
}
