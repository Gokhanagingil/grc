import { Module, MiddlewareConsumer, NestModule, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { DiscoveryModule } from '@nestjs/core';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { AuditLogEntity } from './entities/audit/audit-log.entity';
import { EventRawEntity } from './entities/queue/event-raw.entity';
import { EventNormalizedEntity } from './entities/queue/event-normalized.entity';
import { DataSource, DataSourceOptions } from 'typeorm';
import { PolicyModule } from './modules/policy/policy.module';
import { HealthModule } from './health/health.module';
import { GovModule } from './modules/governance/gov.module';
import { RiskModule } from './modules/risk/risk.module';
import { ComplianceModule } from './modules/compliance/comp.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AuditModule } from './modules/audit/audit.module';
import { IssueModule } from './modules/issue/issue.module';
import { QueueModule } from './modules/queue/queue.module';
import { RulesModule } from './modules/rules/rules.module';
import { DataFoundationModule } from './modules/data-foundation/data-foundation.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { GovernanceModule } from './modules/governance/governance.module';
import { RiskInstanceModule } from './modules/risk-instance/risk-instance.module';
import { RiskScoringModule } from './modules/risk-scoring/risk-scoring.module';
import { SearchModule } from './modules/search/search.module';
import { EntityRegistryModule } from './modules/entity-registry/entity-registry.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { BCMModule } from './modules/bcm/bcm.module';
import { AdminModule } from './modules/admin/admin.module';
import { CalendarModule } from './modules/calendar/calendar.module';
// import { RealtimeModule } from './modules/realtime/realtime.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { PingController } from './ping.controller';
import { validateEnv } from './config/env.validation';
import { CacheModule } from './common/services/cache.module';
import { FEAT } from './config/features';
import { BootInspector } from './common/diagnostics/boot-inspector.service';
import { RoutesController } from './common/controllers/routes.controller';
import { VersionController } from './common/controllers/version.controller';
import { ProtectedController } from './common/controllers/protected.controller';
import { dbConfigFactory } from './config/database.config';

// Conditional imports based on NODE_ENV and SAFE_MODE
const isTestEnv = process.env.NODE_ENV === 'test';
const isDev = process.env.NODE_ENV !== 'production';
const isTestMode = process.env.TEST_MODE === 'true';
const isSafeMode = process.env.SAFE_MODE === 'true' || process.env.SAFE_MODE === '1';

// Throttling: Test mode > Dev > Prod
const throttleLimit = isTestMode
  ? Number(process.env.THROTTLE_TEST_RPM || 600)
  : isDev
    ? 300
    : 10;

@Module({
  controllers: [PingController, RoutesController, VersionController, ProtectedController],
  imports: [
    DiscoveryModule, // For BootInspector
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: throttleLimit,
      },
    ]),
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      validate: validateEnv, // ← fail-fast burada
    }),
    ...(isSafeMode
      ? []
      : [
          TypeOrmModule.forFeature([
            ...(FEAT.AUDIT ? [AuditLogEntity] : []),
            ...(FEAT.QUEUE ? [EventRawEntity, EventNormalizedEntity] : []),
          ]),
        ]),
    TypeOrmModule.forRootAsync({
      useFactory: async (): Promise<TypeOrmModuleOptions> => {
        const logger = new Logger('TypeORM');
        const config = dbConfigFactory();
        
        // Log database type being used
        if (config.type === 'sqlite') {
          logger.warn(`Using SQLite database at ${(config as any).database}`);
        } else {
          logger.log(`Using Postgres database`);
        }
        
        return config;
      },
    }),
    // HealthModule - ALWAYS loaded first, before feature flags
    // This ensures /health and /api/v2/health are always available
    HealthModule,
    // Core modules (always loaded)
    ...(isSafeMode ? [] : [CacheModule, AuthModule, UsersModule, AdminModule]),
    // Optional modules (skip in SAFE_MODE, controlled by feature flags)
    ...(isSafeMode
      ? []
      : [
          ...(FEAT.POLICY ? [PolicyModule] : []),
          ...(FEAT.RISK ? [RiskModule] : []),
          ...(FEAT.COMPLIANCE ? [ComplianceModule] : []),
          ...(FEAT.AUDIT ? [AuditModule] : []),
          ...(FEAT.ISSUE ? [IssueModule] : []),
          ...(FEAT.QUEUE ? [QueueModule] : []),
          ...(FEAT.RULES ? [RulesModule] : []),
          ...(FEAT.DATA_FOUNDATION ? [DataFoundationModule] : []),
          ...(FEAT.DASHBOARD ? [DashboardModule] : []),
          ...(FEAT.GOVERNANCE ? [GovernanceModule, GovModule] : []),
          ...(FEAT.RISK_INSTANCE ? [RiskInstanceModule] : []),
          ...(FEAT.RISK_SCORING ? [RiskScoringModule] : []),
          ...(FEAT.SEARCH ? [SearchModule] : []),
          ...(FEAT.ENTITY_REGISTRY ? [EntityRegistryModule] : []),
          ...(FEAT.METRICS ? [MetricsModule] : []),
          ...(FEAT.BCM ? [BCMModule] : []),
          CalendarModule, // Calendar module (always loaded)
          // ...(FEAT.REALTIME ? [RealtimeModule] : []),
        ]),
  ],
  providers: [
    // BootInspector temporarily disabled for debugging
    // BootInspector, // Boot diagnostics
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // AuditLogInterceptor only loaded in non-test environments
    ...(isTestEnv || isSafeMode || !FEAT.AUDIT
      ? []
      : [
          {
            provide: APP_INTERCEPTOR,
            useClass: AuditLogInterceptor,
          },
        ]),
    // Logging and Metrics interceptors (skip MetricsInterceptor in SAFE_MODE or if METRICS disabled)
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    ...(isSafeMode || !FEAT.METRICS
      ? []
      : [
          {
            provide: APP_INTERCEPTOR,
            useClass: MetricsInterceptor,
          },
        ]),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
