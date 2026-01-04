/**
 * Canonical Database Connection Configuration Builder
 *
 * This module provides a single source of truth for database connection configuration
 * used by both:
 * - TypeORM CLI / migration scripts (via data-source.ts)
 * - NestJS application runtime (via app.module.ts)
 * - E2E test setup (via globalSetup.ts)
 *
 * This ensures all parts of the application use the EXACT same connection settings,
 * preventing issues where migrations connect to one DB and the app connects to another.
 *
 * Environment Variable Priority (FAIL-FAST - no defaults):
 * 1. DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME (primary)
 * 2. DATABASE_URL (postgres://user:password@host:port/dbname)
 * 3. POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB (fallback)
 * 4. FAIL FAST - throw error if none are provided
 *
 * This ensures deterministic, CI-safe configuration that fails immediately if
 * database connection info is not properly configured.
 */

export type ConfigSource = 'DB_*' | 'DATABASE_URL' | 'POSTGRES_*';

export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  source: ConfigSource;
}

/**
 * Parse DATABASE_URL into connection components
 *
 * Supports format: postgres://[user[:password]@]host[:port][/database]
 *
 * @param databaseUrl - DATABASE_URL string
 * @returns Parsed connection config or null if invalid
 */
function parseDatabaseUrl(databaseUrl: string): {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
} | null {
  try {
    const url = new URL(databaseUrl);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
      return null;
    }

    const host = url.hostname || '';
    const port = url.port ? parseInt(url.port, 10) : 5432;
    const username = url.username || '';
    const password = url.password || '';
    // Remove leading slash from pathname
    const database = url.pathname ? url.pathname.slice(1) : '';

    if (!host || !username || !database) {
      return null;
    }

    return { host, port, username, password, database };
  } catch {
    return null;
  }
}

/**
 * Get database connection configuration from environment variables
 *
 * This function reads from process.env directly (not ConfigService) so it can be
 * used by data-source.ts (which runs outside NestJS) and by app.module.ts (which
 * can also read from process.env via ConfigService).
 *
 * FAIL-FAST: Throws an error if no database configuration is found in environment.
 * This ensures CI safety and prevents silent failures with default values.
 *
 * Priority order:
 * 1. DB_* variables (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)
 * 2. DATABASE_URL (parsed postgres:// URL)
 * 3. POSTGRES_* variables (POSTGRES_HOST, etc.)
 * 4. FAIL FAST - throw error if none found
 *
 * @returns DatabaseConnectionConfig with resolved values and source tracking
 * @throws Error if no valid database configuration is found
 */
export function getDatabaseConnectionConfig(): DatabaseConnectionConfig {
  // Priority 1: DB_* variables (all must be present)
  if (
    process.env.DB_HOST &&
    process.env.DB_PORT &&
    process.env.DB_USER &&
    process.env.DB_NAME
  ) {
    const port = parseInt(process.env.DB_PORT, 10);
    if (isNaN(port) || port <= 0) {
      throw new Error(
        `Invalid DB_PORT: "${process.env.DB_PORT}". Must be a positive integer.`,
      );
    }

    return {
      host: process.env.DB_HOST,
      port,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME,
      source: 'DB_*',
    };
  }

  // Priority 2: DATABASE_URL
  if (process.env.DATABASE_URL) {
    const parsed = parseDatabaseUrl(process.env.DATABASE_URL);
    if (parsed) {
      return {
        ...parsed,
        source: 'DATABASE_URL',
      };
    }
    throw new Error(
      `Invalid DATABASE_URL format: "${process.env.DATABASE_URL}". Expected format: postgres://user:password@host:port/database`,
    );
  }

  // Priority 3: POSTGRES_* variables (all must be present)
  if (
    process.env.POSTGRES_HOST &&
    process.env.POSTGRES_PORT &&
    process.env.POSTGRES_USER &&
    process.env.POSTGRES_DB
  ) {
    const port = parseInt(process.env.POSTGRES_PORT, 10);
    if (isNaN(port) || port <= 0) {
      throw new Error(
        `Invalid POSTGRES_PORT: "${process.env.POSTGRES_PORT}". Must be a positive integer.`,
      );
    }

    return {
      host: process.env.POSTGRES_HOST,
      port,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD || '',
      database: process.env.POSTGRES_DB,
      source: 'POSTGRES_*',
    };
  }

  // FAIL FAST - no configuration found
  throw new Error(
    'Database configuration not found. Please provide one of:\n' +
      '  1. DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME\n' +
      '  2. DATABASE_URL (postgres://user:password@host:port/database)\n' +
      '  3. POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB\n' +
      '\n' +
      'This is a fail-fast check to prevent accidental connections to default databases.',
  );
}

/**
 * Build TypeORM DataSourceOptions from database connection config
 *
 * This is used by data-source.ts to create the DataSource for migrations.
 *
 * @returns Partial DataSourceOptions (entities and migrations are set by caller)
 */
export function buildTypeORMDataSourceOptions() {
  const dbConfig = getDatabaseConnectionConfig();

  return {
    type: 'postgres' as const,
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    synchronize: false, // NEVER enable synchronize - always use migrations
  };
}

/**
 * Build NestJS TypeORM configuration from database connection config
 *
 * This is used by app.module.ts to configure TypeOrmModule.
 *
 * @returns TypeORM configuration object for NestJS
 */
export function buildNestJSTypeORMConfig() {
  const dbConfig = getDatabaseConnectionConfig();

  return {
    type: 'postgres' as const,
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    autoLoadEntities: true,
    synchronize: false, // NEVER enable synchronize - always use migrations
  };
}

/**
 * Format connection config for logging (hides password)
 *
 * @param config - Database connection config
 * @returns Safe string representation for logging with source
 */
export function formatConnectionConfigForLogging(
  config: DatabaseConnectionConfig,
): string {
  const connectionString = `postgresql://${config.username}:***@${config.host}:${config.port}/${config.database}`;
  return `${connectionString} (source: ${config.source})`;
}
