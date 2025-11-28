import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSyntheticFlags1730000005100 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get driver type to determine database-specific SQL
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';
    const tablePrefix = isPostgres ? 'public.' : '';

    // Helper function to check if column exists in SQLite
    const columnExists = async (table: string, column: string): Promise<boolean> => {
      if (isPostgres) return true; // Postgres handles IF NOT EXISTS
      const tableInfo = await queryRunner.query(`PRAGMA table_info(${table});`);
      return tableInfo.some((col: any) => col.name === column);
    };

    // Add synthetic column to standard_clause
    const standardClauseTable = `${tablePrefix}standard_clause`;
    const hasSyntheticClause = await columnExists(standardClauseTable, 'synthetic');
    if (isPostgres || !hasSyntheticClause) {
      const boolType = isPostgres ? 'boolean' : 'INTEGER';
      const boolDefault = isPostgres ? 'false' : '0';
      await queryRunner.query(`
        ALTER TABLE ${standardClauseTable} 
        ADD COLUMN ${isPostgres ? 'IF NOT EXISTS' : ''} synthetic ${boolType} NOT NULL DEFAULT ${boolDefault};
      `);
    }

    // Add synthetic column to standard_mapping
    const standardMappingTable = `${tablePrefix}standard_mapping`;
    const hasSyntheticMapping = await columnExists(standardMappingTable, 'synthetic');
    if (isPostgres || !hasSyntheticMapping) {
      const boolType = isPostgres ? 'boolean' : 'INTEGER';
      const boolDefault = isPostgres ? 'false' : '0';
      await queryRunner.query(`
        ALTER TABLE ${standardMappingTable} 
        ADD COLUMN ${isPostgres ? 'IF NOT EXISTS' : ''} synthetic ${boolType} NOT NULL DEFAULT ${boolDefault};
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';
    const tablePrefix = isPostgres ? 'public.' : '';

    if (isPostgres) {
      await queryRunner.query(`
        ALTER TABLE ${tablePrefix}standard_clause 
        DROP COLUMN IF EXISTS synthetic;
      `);

      await queryRunner.query(`
        ALTER TABLE ${tablePrefix}standard_mapping 
        DROP COLUMN IF EXISTS synthetic;
      `);
    }
    // SQLite doesn't support DROP COLUMN easily, skip for down migration
  }
}
