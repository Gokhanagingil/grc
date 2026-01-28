import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to make issue_id column nullable in grc_capas table.
 * This allows creating standalone CAPAs that are not linked to an issue.
 */
export class MakeCapaIssueIdNullable1737700000000 implements MigrationInterface {
  name = 'MakeCapaIssueIdNullable1737700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Make issue_id column nullable
    await queryRunner.query(`
      ALTER TABLE "grc_capas" 
      ALTER COLUMN "issue_id" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: This will fail if there are any rows with NULL issue_id
    // In that case, you would need to either delete those rows or assign them an issue_id first
    await queryRunner.query(`
      ALTER TABLE "grc_capas" 
      ALTER COLUMN "issue_id" SET NOT NULL
    `);
  }
}
