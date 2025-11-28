import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPolicyComplianceRelations1731000000200
  implements MigrationInterface
{
  name = 'AddPolicyComplianceRelations1731000000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get driver type to determine database-specific SQL
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';
    const tablePrefix = isPostgres ? 'public.' : '';

    // Helper function to check if table exists
    const tableExists = async (table: string): Promise<boolean> => {
      if (isPostgres) {
        const result = await queryRunner.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = $1
          );
        `, [table.replace('public.', '')]);
        return result[0]?.exists || false;
      }
      const tables = await queryRunner.query(`SELECT name FROM sqlite_master WHERE type='table' AND name=?;`, [table]);
      return tables.length > 0;
    };

    // Helper function to check if column exists in SQLite
    const columnExists = async (table: string, column: string): Promise<boolean> => {
      if (isPostgres) return true; // Postgres handles IF NOT EXISTS
      if (!(await tableExists(table))) return false;
      const tableInfo = await queryRunner.query(`PRAGMA table_info(${table});`);
      return tableInfo.some((col: any) => col.name === column);
    };

    // Add policy_id to requirements (compliance) - only if requirements table exists
    const requirementsTable = `${tablePrefix}requirements`;
    const reqTableExists = await tableExists(requirementsTable);
    const hasPolicyId = reqTableExists ? await columnExists(requirementsTable, 'policy_id') : false;
    if (reqTableExists && (isPostgres || !hasPolicyId)) {
      const uuidType = isPostgres ? 'UUID' : 'TEXT';
      const refTable = isPostgres ? 'public.policies' : 'policies';
      await queryRunner.query(`
        ALTER TABLE ${requirementsTable} 
        ADD COLUMN ${isPostgres ? 'IF NOT EXISTS' : ''} policy_id ${uuidType}${isPostgres ? ` REFERENCES ${refTable}(id) ON DELETE SET NULL` : ''};
      `);
    }

    // Add clause_id to requirements (link to standard_clause) - only if requirements table exists
    const hasClauseId = reqTableExists ? await columnExists(requirementsTable, 'clause_id') : false;
    if (reqTableExists && (isPostgres || !hasClauseId)) {
      const uuidType = isPostgres ? 'UUID' : 'TEXT';
      const refTable = isPostgres ? 'public.standard_clause' : 'standard_clause';
      await queryRunner.query(`
        ALTER TABLE ${requirementsTable} 
        ADD COLUMN ${isPostgres ? 'IF NOT EXISTS' : ''} clause_id ${uuidType}${isPostgres ? ` REFERENCES ${refTable}(id) ON DELETE SET NULL` : ''};
      `);
    }

    // Add clause_id to control_library (link to standard_clause)
    const controlLibraryTable = `${tablePrefix}control_library`;
    const hasControlClauseId = await columnExists(controlLibraryTable, 'clause_id');
    if (isPostgres || !hasControlClauseId) {
      const uuidType = isPostgres ? 'UUID' : 'TEXT';
      const refTable = isPostgres ? 'public.standard_clause' : 'standard_clause';
      await queryRunner.query(`
        ALTER TABLE ${controlLibraryTable} 
        ADD COLUMN ${isPostgres ? 'IF NOT EXISTS' : ''} clause_id ${uuidType}${isPostgres ? ` REFERENCES ${refTable}(id) ON DELETE SET NULL` : ''};
      `);
    }

    // Create indexes for foreign keys (only if tables exist)
    if (reqTableExists) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_requirements_policy ON ${requirementsTable}(policy_id);
        CREATE INDEX IF NOT EXISTS idx_requirements_clause ON ${requirementsTable}(clause_id);
      `);
    }
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_control_library_clause ON ${controlLibraryTable}(clause_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';
    const tablePrefix = isPostgres ? 'public.' : '';

    await queryRunner.query(`DROP INDEX IF EXISTS idx_control_library_clause;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_requirements_clause;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_requirements_policy;`);

    if (isPostgres) {
      await queryRunner.query(
        `ALTER TABLE ${tablePrefix}control_library DROP COLUMN IF EXISTS clause_id;`,
      );
      await queryRunner.query(
        `ALTER TABLE ${tablePrefix}requirements DROP COLUMN IF EXISTS clause_id;`,
      );
      await queryRunner.query(
        `ALTER TABLE ${tablePrefix}requirements DROP COLUMN IF EXISTS policy_id;`,
      );
    }
    // SQLite doesn't support DROP COLUMN easily, skip for down migration
  }
}
