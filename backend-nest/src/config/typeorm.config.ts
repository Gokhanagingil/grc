import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

const databaseUrl = process.env.DATABASE_URL;

let host = process.env.DB_HOST || 'localhost';
let port = Number(process.env.DB_PORT || 5432);
let database = process.env.DB_NAME || 'grc';
let username = process.env.DB_USER || 'grc_app';
let password = process.env.DB_PASS || 'please-change';
const schema = process.env.DB_SCHEMA || 'public';
const sslEnabled = (process.env.DB_SSL || 'false').toLowerCase() === 'true';

if (databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    host = url.hostname || host;
    port = Number(url.port || port);
    database = url.pathname.replace(/^\//, '') || database;
    username = decodeURIComponent(url.username || username);
    password = decodeURIComponent(url.password || password);
    const schemaParam = url.searchParams.get('schema');
    if (schemaParam) {
      process.env.DB_SCHEMA = schemaParam;
    }
  } catch (error) {
    console.warn(`[TypeORM] Failed to parse DATABASE_URL (${databaseUrl}):`, error);
  }
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  host,
  port,
  username,
  password,
  database,
  schema,
  url: databaseUrl,
  synchronize: false,
  logging: false,
  ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/migrations/*.js'],
});
