import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to add missing tables and columns:
 * - role_permissions: Add created_at, updated_at columns
 * - dictionaries: Create dictionaries table
 * - requirements: Create requirements table
 */
export class AddMissingTablesAndColumns1737000000000 implements MigrationInterface {
  name = 'AddMissingTablesAndColumns1737000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';
    const tablePrefix = isPostgres ? 'auth.' : '';

    // Helper function to check if column exists
    const columnExists = async (table: string, column: string): Promise<boolean> => {
      if (isPostgres) {
        const result = await queryRunner.query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
          ) as exists;
        `, [isPostgres && table.includes('.') ? table.split('.')[0] : 'public', 
            isPostgres && table.includes('.') ? table.split('.')[1] : table, 
            column]);
        return result[0]?.exists || false;
      } else {
        const tableInfo = await queryRunner.query(`PRAGMA table_info(${table.replace('auth.', '')});`);
        return tableInfo.some((col: any) => col.name === column);
      }
    };

    // Helper function to check if table exists
    const tableExists = async (table: string): Promise<boolean> => {
      const tableName = table.includes('.') ? table.split('.')[1] : table;
      const schema = table.includes('.') ? table.split('.')[0] : (isPostgres ? 'public' : null);
      
      if (isPostgres) {
        const result = await queryRunner.query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = $1 AND table_name = $2
          ) as exists;
        `, [schema || 'public', tableName]);
        return result[0]?.exists || false;
      } else {
        const tables = await queryRunner.query(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?;`,
          [tableName]
        );
        return tables.length > 0;
      }
    };

    // 1. Add created_at and updated_at to role_permissions table
    const rolePermissionsTable = isPostgres ? 'auth.role_permissions' : 'role_permissions';
    const rolePermissionsExists = await tableExists(rolePermissionsTable);
    
    if (rolePermissionsExists) {
      const hasCreatedAt = await columnExists(rolePermissionsTable, 'created_at');
      const hasUpdatedAt = await columnExists(rolePermissionsTable, 'updated_at');

      if (!hasCreatedAt) {
        const timestampType = isPostgres ? 'TIMESTAMPTZ NOT NULL DEFAULT now()' : 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP';
        await queryRunner.query(`
          ALTER TABLE ${rolePermissionsTable} 
          ADD COLUMN created_at ${timestampType};
        `);
        console.log('✅ Added created_at column to role_permissions');
      }

      if (!hasUpdatedAt) {
        const timestampType = isPostgres ? 'TIMESTAMPTZ NOT NULL DEFAULT now()' : 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP';
        await queryRunner.query(`
          ALTER TABLE ${rolePermissionsTable} 
          ADD COLUMN updated_at ${timestampType};
        `);
        console.log('✅ Added updated_at column to role_permissions');
      }
    } else {
      console.log('⚠️  role_permissions table does not exist, skipping timestamp columns');
    }

    // 2. Create dictionaries table if it doesn't exist
    const dictionariesTable = isPostgres ? 'public.dictionaries' : 'dictionaries';
    const dictionariesExists = await tableExists(dictionariesTable);
    
    if (!dictionariesExists) {
      const dictionariesTableSql = isPostgres
        ? `
        CREATE TABLE IF NOT EXISTS public.dictionaries (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL,
          domain VARCHAR(100) NOT NULL,
          code VARCHAR(100) NOT NULL,
          label TEXT NOT NULL,
          description TEXT,
          "order" INTEGER DEFAULT 0,
          is_active BOOLEAN NOT NULL DEFAULT true,
          meta TEXT,
          created_by UUID,
          updated_by UUID,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        
        CREATE UNIQUE INDEX IF NOT EXISTS unique_dictionaries_code_domain_tenant 
        ON public.dictionaries(code, domain, tenant_id);
      `
        : `
        CREATE TABLE IF NOT EXISTS dictionaries (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          domain VARCHAR(100) NOT NULL,
          code VARCHAR(100) NOT NULL,
          label TEXT NOT NULL,
          description TEXT,
          "order" INTEGER DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          meta TEXT,
          created_by TEXT,
          updated_by TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await queryRunner.query(dictionariesTableSql);

      // Create indexes
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_dictionaries_tenant ON ${dictionariesTable.replace('public.', '')}(tenant_id);
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_dictionaries_domain ON ${dictionariesTable.replace('public.', '')}(domain);
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_dictionaries_active ON ${dictionariesTable.replace('public.', '')}(is_active);
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
      console.log('⚠️  dictionaries table already exists');
    }

    // 3. Create requirements table if it doesn't exist
    const requirementsTable = isPostgres ? 'public.requirements' : 'requirements';
    const requirementsExists = await tableExists(requirementsTable);
    
    if (!requirementsExists) {
      const uuidType = isPostgres ? 'UUID' : 'TEXT';
      const jsonType = isPostgres ? 'JSONB' : 'TEXT';
      const timestampType = isPostgres ? 'TIMESTAMPTZ NOT NULL DEFAULT now()' : 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP';
      const dateType = isPostgres ? 'DATE' : 'TEXT';

      const requirementsTableSql = isPostgres
        ? `
        CREATE TABLE IF NOT EXISTS public.requirements (
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
        CREATE TABLE IF NOT EXISTS requirements (
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
        CREATE INDEX IF NOT EXISTS idx_requirements_tenant ON ${requirementsTable.replace('public.', '')}(tenant_id);
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_requirements_policy ON ${requirementsTable.replace('public.', '')}(policy_id);
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_requirements_clause ON ${requirementsTable.replace('public.', '')}(clause_id);
      `);
      
      console.log('✅ Created requirements table');
    } else {
      console.log('⚠️  requirements table already exists');
    }

    // 4. Add code column to corrective_actions if it doesn't exist
    const correctiveActionsTable = isPostgres ? 'public.corrective_actions' : 'corrective_actions';
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
      console.log('⚠️  corrective_actions table does not exist, skipping code column');
    }

    // 5. Fix standard_clause UNIQUE index: drop wrong index and create correct one
    const standardClauseTable = isPostgres ? 'public.standard_clause' : 'standard_clause';
    const standardClauseExists = await tableExists(standardClauseTable);
    
    if (standardClauseExists) {
      // Check what indexes exist and drop the wrong one
      if (isPostgres) {
        // Drop wrong index if exists (tenant_id, clause_code)
        await queryRunner.query(`
          DROP INDEX IF EXISTS uq_clause_tenant_code;
        `);
        // Create correct unique index (standard_id, clause_code, tenant_id)
        await queryRunner.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_standard_clause_code_tenant 
          ON ${standardClauseTable}(standard_id, clause_code, tenant_id);
        `);
        console.log('✅ Fixed standard_clause UNIQUE index (Postgres)');
      } else {
        // SQLite: Drop wrong index if exists
        try {
          // Get all indexes for standard_clause
          const indexes = await queryRunner.query(`
            SELECT name FROM sqlite_master 
            WHERE type='index' AND tbl_name='standard_clause' AND sql LIKE '%UNIQUE%';
          `);
          
          // Drop any unique index that has tenant_id, clause_code (wrong order)
          for (const idx of indexes) {
            if (idx.name && (idx.name.includes('tenant') || idx.name.includes('clause'))) {
              try {
                await queryRunner.query(`DROP INDEX IF EXISTS ${idx.name};`);
                console.log(`   Dropped index: ${idx.name}`);
              } catch (e) {
                // Ignore errors
              }
            }
          }
          
          // Create correct unique index
          await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_standard_clause_code_tenant 
            ON ${standardClauseTable}(standard_id, clause_code, tenant_id);
          `);
          console.log('✅ Fixed standard_clause UNIQUE index (SQLite)');
        } catch (e: any) {
          console.log(`⚠️  Could not fix standard_clause index: ${e?.message || e}`);
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';

    // Drop requirements table
    const requirementsTable = isPostgres ? 'public.requirements' : 'requirements';
    await queryRunner.query(`DROP TABLE IF EXISTS ${requirementsTable};`);

    // Drop dictionaries table
    const dictionariesTable = isPostgres ? 'public.dictionaries' : 'dictionaries';
    await queryRunner.query(`DROP TABLE IF EXISTS ${dictionariesTable};`);

    // Remove columns from role_permissions (SQLite doesn't support DROP COLUMN directly)
    const rolePermissionsTable = isPostgres ? 'auth.role_permissions' : 'role_permissions';
    if (isPostgres) {
      await queryRunner.query(`
        ALTER TABLE ${rolePermissionsTable} 
        DROP COLUMN IF EXISTS created_at;
      `);
      await queryRunner.query(`
        ALTER TABLE ${rolePermissionsTable} 
        DROP COLUMN IF EXISTS updated_at;
      `);
    } else {
      console.log('⚠️  SQLite does not support DROP COLUMN. Manual migration required for role_permissions.');
    }
  }
}

