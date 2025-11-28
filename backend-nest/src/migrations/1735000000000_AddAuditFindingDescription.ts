import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditFindingDescription1735000000000 implements MigrationInterface {
  name = 'AddAuditFindingDescription1735000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';

    // Helper function to check if column exists
    const columnExists = async (table: string, column: string): Promise<boolean> => {
      if (isPostgres) {
        const result = await queryRunner.query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = $1 AND column_name = $2
          ) as exists;
        `, [table, column]);
        return result[0]?.exists || false;
      } else {
        const tableInfo = await queryRunner.query(`PRAGMA table_info(${table});`);
        return tableInfo.some((col: any) => col.name === column);
      }
    };

    // Add description column to audit_findings if it doesn't exist
    const hasDescription = await columnExists('audit_findings', 'description');
    if (!hasDescription) {
      if (isPostgres) {
        await queryRunner.query(`
          ALTER TABLE audit_findings 
          ADD COLUMN description TEXT;
        `);
      } else {
        await queryRunner.query(`
          ALTER TABLE audit_findings 
          ADD COLUMN description TEXT;
        `);
      }
      console.log('✅ Added description column to audit_findings');
    } else {
      console.log('⚠️  description column already exists in audit_findings');
    }

    // Add root_cause column to audit_findings if it doesn't exist
    const hasRootCause = await columnExists('audit_findings', 'root_cause');
    if (!hasRootCause) {
      if (isPostgres) {
        await queryRunner.query(`
          ALTER TABLE audit_findings 
          ADD COLUMN root_cause TEXT;
        `);
      } else {
        await queryRunner.query(`
          ALTER TABLE audit_findings 
          ADD COLUMN root_cause TEXT;
        `);
      }
      console.log('✅ Added root_cause column to audit_findings');
    } else {
      console.log('⚠️  root_cause column already exists in audit_findings');
    }

    // Add code column to corrective_actions if it doesn't exist
    const hasCode = await columnExists('corrective_actions', 'code');
    if (!hasCode) {
      if (isPostgres) {
        await queryRunner.query(`
          ALTER TABLE corrective_actions 
          ADD COLUMN code VARCHAR(100) NOT NULL DEFAULT '';
        `);
        // Update existing rows with a default code
        await queryRunner.query(`
          UPDATE corrective_actions 
          SET code = 'CAP-' || substr(id, 1, 8) 
          WHERE code = '' OR code IS NULL;
        `);
        // Make it NOT NULL after setting defaults
        await queryRunner.query(`
          ALTER TABLE corrective_actions 
          ALTER COLUMN code SET NOT NULL;
        `);
      } else {
        // SQLite: Add with default, then update
        await queryRunner.query(`
          ALTER TABLE corrective_actions 
          ADD COLUMN code VARCHAR(100) NOT NULL DEFAULT '';
        `);
        await queryRunner.query(`
          UPDATE corrective_actions 
          SET code = 'CAP-' || substr(id, 1, 8) 
          WHERE code = '' OR code IS NULL;
        `);
      }
      console.log('✅ Added code column to corrective_actions');
    } else {
      console.log('⚠️  code column already exists in corrective_actions');
    }

    // Fix standard_clause UNIQUE index: should be (standard_id, clause_code, tenant_id) not (tenant_id, clause_code)
    // Check if wrong index exists and drop it, then create correct one
    if (isPostgres) {
      // Drop wrong index if exists
      await queryRunner.query(`
        DROP INDEX IF EXISTS uq_clause_tenant_code;
      `);
      // Create correct unique index
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_standard_clause_code_tenant 
        ON standard_clause(standard_id, clause_code, tenant_id);
      `);
      console.log('✅ Fixed standard_clause UNIQUE index');
    } else {
      // SQLite: Drop wrong index if exists
      try {
        await queryRunner.query(`DROP INDEX IF EXISTS uq_clause_tenant_code;`);
      } catch (e) {
        // Index might not exist, ignore
      }
      // Create correct unique index
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_standard_clause_code_tenant 
        ON standard_clause(standard_id, clause_code, tenant_id);
      `);
      console.log('✅ Fixed standard_clause UNIQUE index');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';

    // Remove description column (SQLite doesn't support DROP COLUMN directly)
    if (isPostgres) {
      await queryRunner.query(`
        ALTER TABLE audit_findings 
        DROP COLUMN IF EXISTS description;
      `);
      await queryRunner.query(`
        ALTER TABLE audit_findings 
        DROP COLUMN IF EXISTS root_cause;
      `);
    } else {
      // SQLite: recreate table without the columns
      // This is a simplified version - in production, you'd need to preserve data
      console.log('⚠️  SQLite does not support DROP COLUMN. Manual migration required.');
    }
  }
}

