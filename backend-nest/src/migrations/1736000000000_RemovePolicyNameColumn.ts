import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Remove legacy 'name' column from policies table
 * 
 * The policies table should only have 'title', not 'name'.
 * This migration removes the 'name' column if it exists.
 */
export class RemovePolicyNameColumn1736000000000 implements MigrationInterface {
  name = 'RemovePolicyNameColumn1736000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';
    const tableName = isPostgres ? 'public.policies' : 'policies';

    // Clean up any temporary tables that might exist
    if (isPostgres) {
      // Drop temporary_policies table if it exists
      await queryRunner.query(`
        DROP TABLE IF EXISTS public.temporary_policies CASCADE;
      `).catch(() => {
        // Ignore errors if table doesn't exist
      });
    } else {
      // SQLite: Drop temporary tables
      await queryRunner.query(`
        DROP TABLE IF EXISTS temporary_policies;
      `).catch(() => {
        // Ignore errors
      });
    }

    if (isPostgres) {
      // PostgreSQL: Check if column exists and drop it
      const columnExists = await queryRunner.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'policies' 
          AND column_name = 'name'
        );
      `);

      if (columnExists[0]?.exists) {
        // Check if title column exists
        const titleExists = await queryRunner.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'policies' 
            AND column_name = 'title'
          );
        `);

        if (!titleExists[0]?.exists) {
          // If title doesn't exist, we need to migrate name to title first
          await queryRunner.query(`
            ALTER TABLE ${tableName} 
            ADD COLUMN IF NOT EXISTS title TEXT;
          `);
          
          // Copy name to title where title is NULL
          await queryRunner.query(`
            UPDATE ${tableName} 
            SET title = COALESCE(title, name, 'Untitled Policy')
            WHERE title IS NULL;
          `);

          // Make title NOT NULL if it doesn't have nulls
          await queryRunner.query(`
            ALTER TABLE ${tableName} 
            ALTER COLUMN title SET NOT NULL;
          `);
        }

        // Now drop the name column
        await queryRunner.query(`
          ALTER TABLE ${tableName} 
          DROP COLUMN name;
        `);
        console.log('✅ Dropped legacy "name" column from policies table');
      }
    } else {
      // SQLite: Check if column exists
      const tableInfo = await queryRunner.query(`PRAGMA table_info(${tableName});`);
      const hasNameColumn = tableInfo.some((col: any) => col.name === 'name');
      const hasTitleColumn = tableInfo.some((col: any) => col.name === 'title');

      if (hasNameColumn && hasTitleColumn) {
        // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
        // First, copy data from old table to new table (using title, not name)
        await queryRunner.query(`
          CREATE TABLE policies_new (
            id TEXT PRIMARY KEY NOT NULL,
            tenant_id TEXT NOT NULL,
            code TEXT NOT NULL,
            title TEXT NOT NULL,
            status TEXT NOT NULL,
            owner_first_name TEXT,
            owner_last_name TEXT,
            effective_date TEXT,
            review_date TEXT,
            content TEXT,
            created_by TEXT,
            updated_by TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Copy data, using title (or name if title is NULL) for the title column
        await queryRunner.query(`
          INSERT INTO policies_new (
            id, tenant_id, code, title, status, owner_first_name, owner_last_name,
            effective_date, review_date, content, created_by, updated_by,
            created_at, updated_at
          )
          SELECT 
            id, tenant_id, code,
            COALESCE(title, name, 'Untitled Policy') AS title,
            status, owner_first_name, owner_last_name,
            effective_date, review_date, content, created_by, updated_by,
            created_at, updated_at
          FROM ${tableName};
        `);

        // Drop old table and rename new one
        await queryRunner.query(`DROP TABLE ${tableName};`);
        await queryRunner.query(`ALTER TABLE policies_new RENAME TO ${tableName};`);

        // Recreate indexes
        await queryRunner.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_policies_tenant_code ON ${tableName}(tenant_id, code);
        `);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS idx_policies_tenant ON ${tableName}(tenant_id);
        `);

        console.log('✅ Removed legacy "name" column from policies table (SQLite)');
      } else if (hasNameColumn && !hasTitleColumn) {
        // If table only has 'name' but not 'title', rename 'name' to 'title'
        await queryRunner.query(`
          CREATE TABLE policies_new (
            id TEXT PRIMARY KEY NOT NULL,
            tenant_id TEXT NOT NULL,
            code TEXT NOT NULL,
            title TEXT NOT NULL,
            status TEXT NOT NULL,
            owner_first_name TEXT,
            owner_last_name TEXT,
            effective_date TEXT,
            review_date TEXT,
            content TEXT,
            created_by TEXT,
            updated_by TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);

        await queryRunner.query(`
          INSERT INTO policies_new (
            id, tenant_id, code, title, status, owner_first_name, owner_last_name,
            effective_date, review_date, content, created_by, updated_by,
            created_at, updated_at
          )
          SELECT 
            id, tenant_id, code,
            COALESCE(name, 'Untitled Policy') AS title,
            status, owner_first_name, owner_last_name,
            effective_date, review_date, content, created_by, updated_by,
            created_at, updated_at
          FROM ${tableName};
        `);

        await queryRunner.query(`DROP TABLE ${tableName};`);
        await queryRunner.query(`ALTER TABLE policies_new RENAME TO ${tableName};`);

        await queryRunner.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_policies_tenant_code ON ${tableName}(tenant_id, code);
        `);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS idx_policies_tenant ON ${tableName}(tenant_id);
        `);

        console.log('✅ Renamed "name" column to "title" in policies table (SQLite)');
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Not implementing down migration - we don't want to add back the legacy 'name' column
    console.log('⚠️  Down migration not implemented - "name" column removal is irreversible');
  }
}

