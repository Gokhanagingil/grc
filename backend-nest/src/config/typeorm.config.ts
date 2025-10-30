import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

const host = process.env.DB_HOST || 'localhost';
const port = Number(process.env.DB_PORT || 5432);
const database = process.env.DB_NAME || 'grc';
const username = process.env.DB_USER || 'grc_app';
const password = process.env.DB_PASS || 'please-change';
const schema = process.env.DB_SCHEMA || 'public';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host,
  port,
  username,
  password,
  database,
  schema,
  synchronize: false,
  logging: false,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/src/migrations/*.js'],
});


