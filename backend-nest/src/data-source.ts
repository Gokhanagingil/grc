import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Policy } from './modules/policy/policy.entity';
import { GovPolicy } from './modules/governance/gov.entity';
import { RiskEntity } from './modules/risk/risk.entity';
import { RequirementEntity } from './modules/compliance/comp.entity';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'gokhan',
  username: process.env.DB_USER || 'grc',
  password: process.env.DB_PASS || '123456',
  entities: [Policy, GovPolicy, RiskEntity, RequirementEntity],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: false,
});

export default AppDataSource;


