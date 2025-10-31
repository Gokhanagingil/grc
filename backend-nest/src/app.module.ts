import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PolicyModule } from './modules/policy/policy.module';
import { HealthModule } from './health/health.module';
import { GovModule } from './modules/governance/gov.module';
import { RiskModule } from './modules/risk/risk.module';
import { ComplianceModule } from './modules/compliance/comp.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AuditModule } from './modules/audit/audit.module';
import { IssueModule } from './modules/issue/issue.module';
import { PingController } from './ping.controller';
import { validateEnv } from './config/env.validation';

@Module({
  controllers: [PingController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      validate: validateEnv,     // ← fail-fast burada
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const dbType = process.env.DB_TYPE || 'postgres';
        const config: any = {
          type: dbType,
          host: process.env.DB_HOST || 'localhost',
          port: Number(process.env.DB_PORT || 5432),
          username: process.env.DB_USER || 'grc',
          password: process.env.DB_PASS || '123456',
          database: process.env.DB_NAME || 'grc',
          schema: 'public',
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          autoLoadEntities: true,
          synchronize: process.env.DB_SYNCHRONIZE === 'true',
          migrationsRun: false,
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
          logging: process.env.DB_LOGGING === 'true',
        };
        if (dbType === 'postgres') {
          config.ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;
        }
        return config;
      },
    }),
    HealthModule,
    PolicyModule,
    GovModule,
    RiskModule,
    ComplianceModule,
    AuthModule,
    AuditModule,
    IssueModule,
  ],
})
export class AppModule {}
