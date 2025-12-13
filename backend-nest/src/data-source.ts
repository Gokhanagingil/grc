import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

/**
 * TypeORM Data Source for CLI migrations
 *
 * This data source is used by the TypeORM CLI for running migrations.
 * It uses the same database configuration as the application.
 *
 * Usage:
 *   npm run migration:run    - Run pending migrations
 *   npm run migration:revert - Revert the last migration
 *
 * Environment variables:
 *   DB_HOST     - Database host (default: localhost)
 *   DB_PORT     - Database port (default: 5432)
 *   DB_USER     - Database user (default: postgres)
 *   DB_PASSWORD - Database password (default: postgres)
 *   DB_NAME     - Database name (default: grc_platform)
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'grc_platform',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
