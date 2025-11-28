import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddControlEffectiveness1731000000100
  implements MigrationInterface
{
  name = 'AddControlEffectiveness1731000000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get driver type to determine database-specific SQL
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';
    const tableName = isPostgres ? 'public.control_library' : 'control_library';

    if (isPostgres) {
      await queryRunner.query(`
        ALTER TABLE ${tableName} 
        ADD COLUMN IF NOT EXISTS effectiveness DECIMAL(3,2) DEFAULT 0.3 
          CHECK (effectiveness >= 0 AND effectiveness <= 1);
      `);
    } else {
      // SQLite doesn't support ADD COLUMN IF NOT EXISTS, check first
      const tableInfo = await queryRunner.query(`PRAGMA table_info(${tableName});`);
      const hasEffectiveness = tableInfo.some((col: any) => col.name === 'effectiveness');

      if (!hasEffectiveness) {
        await queryRunner.query(`
          ALTER TABLE ${tableName} 
          ADD COLUMN effectiveness REAL DEFAULT 0.3 
            CHECK (effectiveness >= 0 AND effectiveness <= 1);
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';
    const tableName = isPostgres ? 'public.control_library' : 'control_library';

    if (isPostgres) {
      await queryRunner.query(`
        ALTER TABLE ${tableName} 
        DROP COLUMN IF EXISTS effectiveness;
      `);
    }
    // SQLite doesn't support DROP COLUMN easily, skip for down migration
  }
}
