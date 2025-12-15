/**
 * Migrations Status Script
 *
 * Prints the last 20 migration records from the database.
 * Useful for checking migration status in production.
 *
 * Usage: npm run migrations:status:prod
 *
 * Environment variables:
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 *   POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB (fallbacks)
 */

import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// Load environment variables
config();

async function showMigrationsStatus() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(
      process.env.DB_PORT || process.env.POSTGRES_PORT || '5432',
      10,
    ),
    username: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
    password:
      process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.DB_NAME || process.env.POSTGRES_DB || 'grc_platform',
  });

  try {
    console.log('Connecting to database...\n');
    await dataSource.initialize();

    // Query migrations table (TypeORM default table name)
    // TypeORM query() returns any[] by design, so we need to handle it
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const migrations = await dataSource.query(
      `SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 20`,
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (migrations.length === 0) {
      console.log('No migrations found in the database.');
      console.log('This could mean:');
      console.log('  - No migrations have been run yet');
      console.log('  - The migrations table does not exist');
      console.log('  - The database is empty\n');
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      console.log(`Found ${migrations.length} migration(s):\n`);
      console.log(
        'Timestamp'.padEnd(20) + ' | ' + 'Name'.padEnd(60) + ' | ' + 'ID',
      );
      console.log('-'.repeat(100));

      for (const migration of migrations as Array<Record<string, unknown>>) {
        const timestampRaw = migration.timestamp;
        let timestamp = 'N/A';
        if (timestampRaw != null) {
          const tsNum =
            typeof timestampRaw === 'number'
              ? timestampRaw
              : typeof timestampRaw === 'string'
                ? parseInt(timestampRaw, 10)
                : null;
          if (tsNum != null && !isNaN(tsNum)) {
            timestamp = new Date(tsNum).toISOString();
          }
        }

        const nameRaw = migration.name;
        const name =
          typeof nameRaw === 'string'
            ? nameRaw
            : typeof nameRaw === 'number' || typeof nameRaw === 'boolean'
              ? String(nameRaw)
              : 'N/A';

        const idRaw = migration.id;
        const id =
          typeof idRaw === 'string' || typeof idRaw === 'number'
            ? String(idRaw)
            : 'N/A';

        const line = `${timestamp.padEnd(20)} | ${name.padEnd(60)} | ${id}`;
        console.log(line);
      }
      console.log('');
    }

    // Also check if migrations table exists
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const tableExists = await dataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'migrations'
      );
    `);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!tableExists[0]?.exists) {
      console.log(
        'WARNING: The migrations table does not exist in the database.',
      );
      console.log(
        'Run migrations first: npx typeorm migration:run -d dist/data-source.js\n',
      );
    }
  } catch (error) {
    console.error('Error checking migrations status:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
    }
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

// Run the script
showMigrationsStatus()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
