import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Policy } from './modules/policy/policy.entity';
import { GovPolicy } from './modules/governance/gov.entity';
import { RiskEntity } from './modules/risk/risk.entity';
import { RequirementEntity } from './modules/compliance/comp.entity';
import { AuditEntity } from './modules/audit/audit.entity';
import { IssueEntity } from './modules/issue/issue.entity';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'grc',
  username: process.env.DB_USER || 'grc',
  password: process.env.DB_PASS || '123456',
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  logging: process.env.DB_LOGGING === 'true',
});

export default AppDataSource;


