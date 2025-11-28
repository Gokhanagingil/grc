import { DataSourceOptions } from 'typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { config } from 'dotenv';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

// TypeOrmModuleOptions extends DataSourceOptions with NestJS-specific properties like autoLoadEntities
export function dbConfigFactory(): TypeOrmModuleOptions {
  const isDev = process.env.NODE_ENV !== 'production';
  const isProd = process.env.NODE_ENV === 'production';
  const safeMode =
    process.env.SAFE_MODE === 'true' || process.env.SAFE_MODE === '1';

  // Database engine selection: DB_ENGINE is the primary way to specify database type
  // If DB_ENGINE is not set or is 'sqlite', use SQLite
  // If DB_ENGINE === 'postgres', use Postgres
  const dbEngine = (process.env.DB_ENGINE || 'sqlite').toLowerCase();

  // Database strategy: controls synchronize behavior
  // 'legacy-sync' (default): SQLite dev uses synchronize: true, prod uses synchronize: false
  // 'migration-dev': Dev also uses migration-first (synchronize: false)
  // 'migration-prod': Production always uses migration-first (synchronize: false)
  // Note: In Sprint 2, this is prepared but not activated. Default remains 'legacy-sync'
  const dbStrategy = (process.env.DB_STRATEGY || 'legacy-sync').toLowerCase();

  const entities = isDev
    ? [path.join(__dirname, '..', '**', '*.entity.ts')]
    : [path.join(__dirname, '..', '..', 'dist', '**', '*.entity.js')];

  const migrations = isDev
    ? [path.join(__dirname, '..', 'migrations', '*.ts')]
    : [path.join(__dirname, '..', '..', 'dist', 'migrations', '*.js')];

  const logging = process.env.DB_LOGGING === 'true';

  // SQLite configuration (default or when DB_ENGINE=sqlite or not set)
  // SAFE_MODE also forces SQLite
  // Use SQLite if: safeMode is on, or dbEngine is 'sqlite', or dbEngine is not 'postgres'
  if (safeMode || dbEngine === 'sqlite' || dbEngine !== 'postgres') {
    const sqliteFile = process.env.SQLITE_FILE || './data/grc.sqlite';
    const sqlitePath = path.isAbsolute(sqliteFile)
      ? sqliteFile
      : path.join(process.cwd(), sqliteFile);

    const sqliteDir = path.dirname(sqlitePath);
    if (!fs.existsSync(sqliteDir)) {
      fs.mkdirSync(sqliteDir, { recursive: true });
    }

    // Base SQLite config
    const sqliteConfig: any = {
      type: 'sqlite',
      database: sqlitePath,
      entities,
      migrations,
      // SQLite synchronize behavior:
      // Always use migrations, never synchronize (prevents temporary table issues)
      synchronize: false,
      migrationsRun: true,
      logging,
      dropSchema: false,
    };

    // Add NestJS-specific property
    // autoLoadEntities allows automatic discovery of entities decorated with @Entity()
    sqliteConfig.autoLoadEntities = true;

    return sqliteConfig as TypeOrmModuleOptions;
  }

  // Postgres configuration (only when DB_ENGINE=postgres explicitly)
  // Postgres: NEVER use synchronize, always use migrations
  if (dbEngine === 'postgres') {
    const databaseUrl = process.env.DATABASE_URL;

    // Validate Postgres configuration
    if (!databaseUrl) {
      // Check individual env variables
      const dbHost = process.env.DB_HOST || process.env.PGHOST;
      const dbName = process.env.DB_NAME || process.env.PGDATABASE;

      if (!dbHost || !dbName) {
        const missing = [];
        if (!dbHost) missing.push('DB_HOST');
        if (!dbName) missing.push('DB_NAME');
        throw new Error(
          `Postgres config incomplete: ${missing.join('/')} missing. ` +
          `Either set DATABASE_URL or provide DB_HOST and DB_NAME.`
        );
      }
    }

    if (databaseUrl) {
      // Base Postgres config with URL
      const postgresUrlConfig: any = {
        type: 'postgres',
        url: databaseUrl,
        entities,
        migrations,
        synchronize: false, // Postgres: always false, use migrations
        migrationsRun: true,
        logging,
        dropSchema: false,
        ssl:
          process.env.DB_SSL === 'true'
            ? { rejectUnauthorized: false }
            : undefined,
        extra: {
          connectionTimeoutMillis: 2000,
        },
      };

      // Add NestJS-specific property
      // autoLoadEntities allows automatic discovery of entities decorated with @Entity()
      postgresUrlConfig.autoLoadEntities = true;

      return postgresUrlConfig as TypeOrmModuleOptions;
    }

    // Postgres config with individual env variables
    const postgresConfig: any = {
      type: 'postgres',
      host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
      port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
      username: process.env.DB_USER || process.env.PGUSER || 'postgres',
      password: process.env.DB_PASS || process.env.PGPASSWORD || 'postgres',
      database: process.env.DB_NAME || process.env.PGDATABASE || 'postgres',
      schema: process.env.DB_SCHEMA || 'public',
      entities,
      migrations,
      synchronize: false, // Postgres: always false, use migrations
      migrationsRun: true,
      logging,
      dropSchema: false,
      ssl:
        process.env.DB_SSL === 'true'
          ? { rejectUnauthorized: false }
          : undefined,
      extra: {
        connectionTimeoutMillis: 2000,
      },
    };

    // Add NestJS-specific property
    // autoLoadEntities allows automatic discovery of entities decorated with @Entity()
    postgresConfig.autoLoadEntities = true;

    return postgresConfig as TypeOrmModuleOptions;
  }

  // Fallback: should never reach here, but return SQLite as default
  console.warn('⚠️  Unknown DB_ENGINE value, falling back to SQLite');
  const sqliteFile = process.env.SQLITE_FILE || './data/grc.sqlite';
  const sqlitePath = path.isAbsolute(sqliteFile)
    ? sqliteFile
    : path.join(process.cwd(), sqliteFile);

  const sqliteDir = path.dirname(sqlitePath);
  if (!fs.existsSync(sqliteDir)) {
    fs.mkdirSync(sqliteDir, { recursive: true });
  }

  return {
    type: 'sqlite',
    database: sqlitePath,
    entities,
    migrations,
    synchronize: false, // Always use migrations, never synchronize
    migrationsRun: true,
    logging,
    dropSchema: false,
    autoLoadEntities: true, // Allows automatic discovery of entities decorated with @Entity()
  } as TypeOrmModuleOptions;
}
