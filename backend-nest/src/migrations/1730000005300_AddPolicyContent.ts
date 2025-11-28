import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPolicyContent1730000005300 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get driver type to determine database-specific SQL
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';
    const tableName = isPostgres ? 'public.policies' : 'policies';

    if (isPostgres) {
      await queryRunner.query(`
        ALTER TABLE ${tableName} 
        ADD COLUMN IF NOT EXISTS content TEXT;
      `);
    } else {
      // SQLite doesn't support ADD COLUMN IF NOT EXISTS, check first
      const tableInfo = await queryRunner.query(`PRAGMA table_info(${tableName});`);
      const hasContent = tableInfo.some((col: any) => col.name === 'content');

      if (!hasContent) {
        await queryRunner.query(`
          ALTER TABLE ${tableName} 
          ADD COLUMN content TEXT;
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';
    const tableName = isPostgres ? 'public.policies' : 'policies';

    if (isPostgres) {
      await queryRunner.query(`
        ALTER TABLE ${tableName} 
        DROP COLUMN IF EXISTS content;
      `);
    }
    // SQLite doesn't support DROP COLUMN easily, skip for down migration
  }
}
