import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PolicyModule } from './modules/policy/policy.module';
import { HealthModule } from './health/health.module';
import { GovModule } from './modules/governance/gov.module';
import { RiskModule } from './modules/risk/risk.module';
import { ComplianceModule } from './modules/compliance/comp.module';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      validate: validateEnv,     // ← fail-fast burada
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST!,
      port: Number(process.env.DB_PORT!),
      database: process.env.DB_NAME!,
      username: process.env.DB_USER!,
      password: process.env.DB_PASS!,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      schema: 'public',
      autoLoadEntities: true,
      synchronize: false,
      logging: false,
    }),
    HealthModule,
    PolicyModule,
    GovModule,
    RiskModule,
    ComplianceModule,
    AuthModule,
  ],
})
export class AppModule {}
