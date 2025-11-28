import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to fix schema alignment issues:
 * 1. Ensure dictionaries table exists with correct schema
 * 2. Ensure requirements table exists with correct schema
 * 3. Ensure role_permissions has created_at and updated_at columns
 * 4. Fix standard_clause UNIQUE index (standard_id, clause_code, tenant_id)
 * 5. Add code column to corrective_actions if missing
 */
export class FixDictionariesRequirementsAndRolePermissions1738000000000
  implements MigrationInterface
{
  name = 'FixDictionariesRequirementsAndRolePermissions1738000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';

    // Helper function to check if column exists
    const columnExists = async (
      table: string,
      column: string,
    ): Promise<boolean> => {
      if (isPostgres) {
        const schema = table.includes('.') ? table.split('.')[0] : 'public';
        const tableName = table.includes('.') ? table.split('.')[1] : table;
        const result = await queryRunner.query(
          `
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
          ) as exists;
        `,
          [schema, tableName, column],
        );
        return result[0]?.exists || false;
      } else {
        const tableName = table.replace(/^[^.]+\./, ''); // Remove schema prefix
        const tableInfo = await queryRunner.query(
          `PRAGMA table_info(${tableName});`,
        );
        return tableInfo.some((col: any) => col.name === column);
      }
    };

    // Helper function to check if table exists
    const tableExists = async (table: string): Promise<boolean> => {
      const tableName = table.includes('.') ? table.split('.')[1] : table;
      const schema = table.includes('.') ? table.split('.')[0] : isPostgres ? 'public' : null;

      if (isPostgres) {
        const result = await queryRunner.query(
          `
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = $1 AND table_name = $2
          ) as exists;
        `,
          [schema || 'public', tableName],
        );
        return result[0]?.exists || false;
      } else {
        const tables = await queryRunner.query(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?;`,
          [tableName],
        );
        return tables.length > 0;
      }
    };

    // Helper function to check if index exists
    const indexExists = async (indexName: string, tableName: string): Promise<boolean> => {
      if (isPostgres) {
        const result = await queryRunner.query(
          `
          SELECT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = $1 AND tablename = $2
          ) as exists;
        `,
          [indexName, tableName],
        );
        return result[0]?.exists || false;
      } else {
        const indexes = await queryRunner.query(
          `SELECT name FROM sqlite_master WHERE type='index' AND name=?;`,
          [indexName],
        );
        return indexes.length > 0;
      }
    };

    // 1. Ensure dictionaries table exists with correct schema
    const dictionariesTable = isPostgres ? 'public.dictionaries' : 'dictionaries';
    const dictionariesExists = await tableExists(dictionariesTable);

    if (!dictionariesExists) {
      const dictionariesTableSql = isPostgres
        ? `
        CREATE TABLE public.dictionaries (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL,
          domain VARCHAR(100) NOT NULL,
          code VARCHAR(100) NOT NULL,
          label TEXT NOT NULL,
          description TEXT,
          "order" INTEGER DEFAULT 0,
          is_active BOOLEAN NOT NULL DEFAULT true,
          meta JSONB DEFAULT '{}',
          created_by UUID,
          updated_by UUID,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        
        CREATE UNIQUE INDEX unique_dictionaries_code_domain_tenant 
        ON public.dictionaries(code, domain, tenant_id);
      `
        : `
        CREATE TABLE dictionaries (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          domain VARCHAR(100) NOT NULL,
          code VARCHAR(100) NOT NULL,
          label TEXT NOT NULL,
          description TEXT,
          "order" INTEGER DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          meta TEXT DEFAULT '{}',
          created_by TEXT,
          updated_by TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await queryRunner.query(dictionariesTableSql);

      // Create indexes
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_dictionaries_tenant ON dictionaries(tenant_id);
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_dictionaries_domain ON dictionaries(domain);
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_dictionaries_active ON dictionaries(is_active);
      `);

      if (!isPostgres) {
        // SQLite unique constraint via index
        await queryRunner.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_dictionaries_code_domain_tenant 
          ON dictionaries(code, domain, tenant_id);
        `);
      }

      console.log('✅ Created dictionaries table');
    } else {
      // Check if order column exists (might be named differently)
      const hasOrder = await columnExists(dictionariesTable, 'order');
      if (!hasOrder) {
        const orderType = isPostgres ? 'INTEGER DEFAULT 0' : 'INTEGER DEFAULT 0';
        await queryRunner.query(`
          ALTER TABLE ${dictionariesTable} 
          ADD COLUMN "order" ${orderType};
        `);
        console.log('✅ Added order column to dictionaries');
      }
    }

    // 2. Ensure requirements table exists with correct schema
    const requirementsTable = isPostgres ? 'public.requirements' : 'requirements';
    const requirementsExists = await tableExists(requirementsTable);

    if (!requirementsExists) {
      const uuidType = isPostgres ? 'UUID' : 'TEXT';
      const jsonType = isPostgres ? 'JSONB' : 'TEXT';
      const timestampType = isPostgres
        ? 'TIMESTAMPTZ NOT NULL DEFAULT now()'
        : 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP';
      const dateType = isPostgres ? 'DATE' : 'TEXT';

      const requirementsTableSql = isPostgres
        ? `
        CREATE TABLE public.requirements (
          id ${uuidType} PRIMARY KEY${isPostgres ? ' DEFAULT gen_random_uuid()' : ''},
          tenant_id ${uuidType} NOT NULL,
          title VARCHAR(160) NOT NULL,
          description TEXT,
          regulation_id ${uuidType},
          regulation VARCHAR(120),
          categories ${jsonType},
          category VARCHAR(80),
          status VARCHAR(32) NOT NULL DEFAULT 'pending',
          due_date ${dateType},
          evidence TEXT,
          owner_first_name VARCHAR(80),
          owner_last_name VARCHAR(80),
          assigned_first_name VARCHAR(80),
          assigned_last_name VARCHAR(80),
          policy_id ${uuidType},
          clause_id ${uuidType},
          created_at ${timestampType},
          updated_at ${timestampType},
          deleted_at ${timestampType.replace('NOT NULL', '').replace('DEFAULT now()', '').replace('DEFAULT CURRENT_TIMESTAMP', '')}
        );
      `
        : `
        CREATE TABLE requirements (
          id ${uuidType} PRIMARY KEY,
          tenant_id ${uuidType} NOT NULL,
          title VARCHAR(160) NOT NULL,
          description TEXT,
          regulation_id ${uuidType},
          regulation VARCHAR(120),
          categories ${jsonType},
          category VARCHAR(80),
          status VARCHAR(32) NOT NULL DEFAULT 'pending',
          due_date ${dateType},
          evidence TEXT,
          owner_first_name VARCHAR(80),
          owner_last_name VARCHAR(80),
          assigned_first_name VARCHAR(80),
          assigned_last_name VARCHAR(80),
          policy_id ${uuidType},
          clause_id ${uuidType},
          created_at ${timestampType},
          updated_at ${timestampType},
          deleted_at ${timestampType.replace('NOT NULL', '').replace('DEFAULT CURRENT_TIMESTAMP', '')}
        );
      `;
      await queryRunner.query(requirementsTableSql);

      // Create indexes
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_requirements_tenant ON requirements(tenant_id);
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_requirements_policy ON requirements(policy_id);
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_requirements_clause ON requirements(clause_id);
      `);

      console.log('✅ Created requirements table');
    }

    // 3. Ensure role_permissions has created_at and updated_at columns
    const rolePermissionsTable = isPostgres
      ? 'auth.role_permissions'
      : 'role_permissions';
    const rolePermissionsExists = await tableExists(rolePermissionsTable);

    if (rolePermissionsExists) {
      const hasCreatedAt = await columnExists(rolePermissionsTable, 'created_at');
      const hasUpdatedAt = await columnExists(rolePermissionsTable, 'updated_at');

      if (!hasCreatedAt) {
        const timestampType = isPostgres
          ? 'TIMESTAMPTZ NOT NULL DEFAULT now()'
          : 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP';
        await queryRunner.query(`
          ALTER TABLE ${rolePermissionsTable} 
          ADD COLUMN created_at ${timestampType};
        `);
        console.log('✅ Added created_at column to role_permissions');
      }

      if (!hasUpdatedAt) {
        const timestampType = isPostgres
          ? 'TIMESTAMPTZ NOT NULL DEFAULT now()'
          : 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP';
        await queryRunner.query(`
          ALTER TABLE ${rolePermissionsTable} 
          ADD COLUMN updated_at ${timestampType};
        `);
        console.log('✅ Added updated_at column to role_permissions');
      }
    }

    // 4. Fix standard_clause UNIQUE index - drop wrong index and create correct one
    const standardClauseTable = isPostgres
      ? 'public.standard_clause'
      : 'standard_clause';
    const standardClauseExists = await tableExists(standardClauseTable);

    if (standardClauseExists) {
      if (isPostgres) {
        // Drop wrong unique constraint/index if exists
        try {
          await queryRunner.query(`
            DROP INDEX IF EXISTS uq_clause_tenant_code;
          `);
          await queryRunner.query(`
            DROP INDEX IF EXISTS idx_standard_clause_code_tenant;
          `);
          // Also try to drop constraint if it exists
          await queryRunner.query(`
            ALTER TABLE ${standardClauseTable} 
            DROP CONSTRAINT IF EXISTS uq_clause_tenant_code CASCADE;
          `);
        } catch (e) {
          // Ignore errors
        }

        // Create correct unique index
        await queryRunner.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_standard_clause_unique 
          ON ${standardClauseTable}(standard_id, clause_code, tenant_id);
        `);
        console.log('✅ Fixed standard_clause UNIQUE index (Postgres)');
      } else {
        // SQLite: Get all unique indexes for standard_clause
        try {
          const indexes = await queryRunner.query(`
            SELECT name, sql FROM sqlite_master 
            WHERE type='index' AND tbl_name='standard_clause' AND sql LIKE '%UNIQUE%';
          `);

          // Drop wrong unique indexes
          for (const idx of indexes) {
            if (idx.name) {
              // Check if it's the wrong index (tenant_id, clause_code without standard_id)
              const indexInfo = await queryRunner.query(
                `PRAGMA index_info(${idx.name});`,
              );
              const columns = indexInfo.map((info: any) => info.name);
              
              // If it doesn't include standard_id, it's wrong
              if (!columns.includes('standard_id') && columns.includes('tenant_id') && columns.includes('clause_code')) {
                try {
                  await queryRunner.query(`DROP INDEX IF EXISTS ${idx.name};`);
                  console.log(`   Dropped wrong index: ${idx.name}`);
                } catch (e) {
                  // Ignore errors
                }
              }
            }
          }

          // Also drop the correct one if it exists (to recreate it)
          await queryRunner.query(`
            DROP INDEX IF EXISTS idx_standard_clause_unique;
          `);

          // Create correct unique index
          await queryRunner.query(`
            CREATE UNIQUE INDEX idx_standard_clause_unique 
            ON standard_clause(standard_id, clause_code, tenant_id);
          `);
          console.log('✅ Fixed standard_clause UNIQUE index (SQLite)');
        } catch (e: any) {
          console.log(
            `⚠️  Could not fix standard_clause index: ${e?.message || e}`,
          );
        }
      }
    }

    // 5. Add code column to corrective_actions if it doesn't exist
    const correctiveActionsTable = isPostgres
      ? 'public.corrective_actions'
      : 'corrective_actions';
    const correctiveActionsExists = await tableExists(correctiveActionsTable);

    if (correctiveActionsExists) {
      const hasCode = await columnExists(correctiveActionsTable, 'code');

      if (!hasCode) {
        if (isPostgres) {
          await queryRunner.query(`
            ALTER TABLE ${correctiveActionsTable} 
            ADD COLUMN code VARCHAR(100) NOT NULL DEFAULT '';
          `);
          // Update existing rows with a default code
          await queryRunner.query(`
            UPDATE ${correctiveActionsTable} 
            SET code = 'CAP-' || substr(id::text, 1, 8) 
            WHERE code = '' OR code IS NULL;
          `);
        } else {
          // SQLite: Add with default, then update
          await queryRunner.query(`
            ALTER TABLE ${correctiveActionsTable} 
            ADD COLUMN code VARCHAR(100) NOT NULL DEFAULT '';
          `);
          await queryRunner.query(`
            UPDATE ${correctiveActionsTable} 
            SET code = 'CAP-' || substr(id, 1, 8) 
            WHERE code = '' OR code IS NULL;
          `);
        }
        console.log('✅ Added code column to corrective_actions');
      } else {
        console.log('⚠️  code column already exists in corrective_actions');
      }
    } else {
      console.log(
        '⚠️  corrective_actions table does not exist, skipping code column',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';

    // Note: This is a fix migration, so down() is minimal
    // We don't want to break things by removing columns/tables that might be needed

    // Remove code column from corrective_actions (only if safe)
    const correctiveActionsTable = isPostgres
      ? 'public.corrective_actions'
      : 'corrective_actions';
    if (isPostgres) {
      await queryRunner.query(`
        ALTER TABLE ${correctiveActionsTable} 
        DROP COLUMN IF EXISTS code;
      `);
    } else {
      console.log(
        '⚠️  SQLite does not support DROP COLUMN. Manual migration required for corrective_actions.code.',
      );
    }

    // Revert standard_clause index (restore wrong one - not recommended but for completeness)
    const standardClauseTable = isPostgres
      ? 'public.standard_clause'
      : 'standard_clause';
    if (isPostgres) {
      await queryRunner.query(`
        DROP INDEX IF EXISTS idx_standard_clause_unique;
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_clause_tenant_code 
        ON ${standardClauseTable}(tenant_id, clause_code);
      `);
    } else {
      await queryRunner.query(`
        DROP INDEX IF EXISTS idx_standard_clause_unique;
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_clause_tenant_code 
        ON standard_clause(tenant_id, clause_code);
      `);
    }
  }
}

