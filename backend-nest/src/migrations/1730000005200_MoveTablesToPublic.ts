import { MigrationInterface, QueryRunner } from 'typeorm';

export class MoveTablesToPublic1730000005200 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get driver type to determine database-specific SQL
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';

    // SQLite doesn't support schemas, so this migration is a no-op for SQLite
    if (!isPostgres) {
      console.log('⚠️  SQLite doesn\'t support schemas, skipping schema move');
      return;
    }

    // Move all tables from app schema to public schema
    const tables = [
      'risk_category',
      'standard',
      'standard_clause',
      'control_library',
      'risk_catalog',
      'standard_mapping',
      'control_to_clause',
      'risk_to_control',
      'policies',
    ];

    for (const table of tables) {
      // Check if table exists in app schema
      const tableExists = await queryRunner.query(
        `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'app' AND table_name = $1
        );
      `,
        [table],
      );

      if (tableExists[0]?.exists) {
        // Check if table already exists in public schema
        const publicTableExists = await queryRunner.query(
          `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = $1
          );
        `,
          [table],
        );

        if (!publicTableExists[0]?.exists) {
          // Move table from app to public
          await queryRunner.query(`
            ALTER TABLE app.${table} SET SCHEMA public;
          `);
          console.log(`✅ Moved table ${table} from app to public`);
        } else {
          console.log(
            `⚠️  Table ${table} already exists in public schema, skipping`,
          );
        }
      } else {
        console.log(
          `⚠️  Table ${table} does not exist in app schema, skipping`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Get driver type to determine database-specific SQL
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';

    // SQLite doesn't support schemas, so this migration is a no-op for SQLite
    if (!isPostgres) {
      return;
    }

    // Move tables back to app schema (if needed for rollback)
    const tables = [
      'risk_category',
      'standard',
      'standard_clause',
      'control_library',
      'risk_catalog',
      'standard_mapping',
      'control_to_clause',
      'risk_to_control',
      'policies',
    ];

    for (const table of tables) {
      const publicTableExists = await queryRunner.query(
        `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        );
      `,
        [table],
      );

      if (publicTableExists[0]?.exists) {
        await queryRunner.query(`
          ALTER TABLE public.${table} SET SCHEMA app;
        `);
      }
    }
  }
}
