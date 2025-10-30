import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PolicyModule } from './modules/policy/policy.module';
import { HealthController } from './common/health.controller';
import { GovModule } from './modules/governance/gov.module';
import { RiskModule } from './modules/risk/risk.module';
import { ComplianceModule } from './modules/compliance/comp.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'gokhan',
      username: process.env.DB_USER || 'grc',
      password: process.env.DB_PASS || '123456',
      autoLoadEntities: true,
      synchronize: false,
      logging: false,
    }),
    PolicyModule,
    GovModule,
    RiskModule,
    ComplianceModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
