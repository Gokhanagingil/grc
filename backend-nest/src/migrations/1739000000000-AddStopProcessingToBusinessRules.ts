import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStopProcessingToBusinessRules1739000000000
  implements MigrationInterface
{
  name = 'AddStopProcessingToBusinessRules1739000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "itsm_business_rules"
        ADD COLUMN IF NOT EXISTS "stop_processing" boolean NOT NULL DEFAULT false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "itsm_business_rules"
        DROP COLUMN IF EXISTS "stop_processing";
    `);
  }
}
