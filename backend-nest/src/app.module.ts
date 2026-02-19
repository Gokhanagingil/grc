import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR, APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { MethodBasedThrottlerGuard } from './common/guards';
import { configuration, validate } from './config';
import { EventsModule } from './events/events.module';
import { AuditModule } from './audit/audit.module';
import { SettingsModule } from './settings/settings.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { GrcModule } from './grc/grc.module';
import { ItsmModule } from './itsm/itsm.module';
import { CopilotModule } from './copilot/copilot.module';
import { MetricsModule } from './metrics/metrics.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { PlatformModule } from './platform/platform.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { JobsModule } from './jobs/jobs.module';
import { TodosModule } from './todos/todos.module';
import { EventBusModule } from './event-bus/event-bus.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  CorrelationIdMiddleware,
  SecurityHeadersMiddleware,
} from './common/middleware';
import {
  RequestTimingInterceptor,
  PerformanceInterceptor,
  ResponseTransformInterceptor,
} from './common/interceptors';
import { GlobalExceptionFilter } from './common/filters';
import { StructuredLoggerService } from './common/logger';

/**
 * App Module
 *
 * Root module that wires together all application modules.
 *
 * This NestJS backend runs alongside the existing Express backend:
 * - Express backend: port 3001
 * - NestJS backend: port 3002 (default)
 *
 * Both backends can share the same PostgreSQL database (grc_platform),
 * but use separate tables to avoid conflicts during migration:
 * - Express: uses 'users' table with integer IDs
 * - NestJS: uses 'nest_users' table with UUID IDs
 */
@Module({
  imports: [
    // Configuration with validation (fail-fast if invalid)
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),

    // TypeORM PostgreSQL connection
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // Get config values with safe defaults (validation ensures critical values exist)
        const dbHost = configService.get<string>('db.host', 'localhost');
        const dbPort = configService.get<number>('db.port', 5432);
        const dbUser = configService.get<string>('db.user', 'postgres');
        const dbPassword = configService.get<string>('db.password', 'postgres');
        const dbName = configService.get<string>('db.name', 'grc_platform');
        const nodeEnv = configService.get<string>('app.nodeEnv', 'development');

        // KILL SWITCH: DB_SYNC is banned in production/staging
        // Check if DB_SYNC env var is explicitly set to 'true' in production/staging
        const dbSyncEnv = process.env.DB_SYNC;
        const isProductionEnv =
          nodeEnv === 'production' || nodeEnv === 'staging';
        if (isProductionEnv && dbSyncEnv === 'true') {
          console.error(
            '\n============================================================',
          );
          console.error('FATAL: DB_SYNC=true is BANNED in production/staging!');
          console.error(
            '============================================================',
          );
          console.error(`Environment: ${nodeEnv}`);
          console.error(
            'DB_SYNC=true would enable TypeORM auto-sync, which is',
          );
          console.error('dangerous and non-deterministic in production.');
          console.error('');
          console.error('SOLUTION:');
          console.error('  1. Set DB_SYNC=false (or remove the env var)');
          console.error(
            '  2. Use migrations instead: npm run migration:run:prod',
          );
          console.error(
            '============================================================\n',
          );
          process.exit(1);
        }

        // synchronize is ALWAYS false - never inferred from ambiguous flags
        // configuration.ts already sets it to false, but we enforce it here too
        const synchronize = false;

        return {
          type: 'postgres',
          host: dbHost,
          port: dbPort,
          username: dbUser,
          password: dbPassword,
          database: dbName,
          autoLoadEntities: true,
          // synchronize is ALWAYS false - use migrations instead
          synchronize,
          logging: nodeEnv === 'development',
        };
      },
    }),

    // Event bus (must be before modules that emit events)
    EventsModule,

    // Durable Event Bus (sys_event persistence + event log)
    EventBusModule,

    // Feature modules
    HealthModule,
    UsersModule,
    AuthModule,
    TenantsModule,
    SettingsModule,

    // GRC Domain Model (Risk, Control, Policy, Requirement, Issue, CAPA, Evidence)
    GrcModule,

    // ITSM Domain Model (Incident, Problem, Change - future)
    ItsmModule,

    // Copilot AI Decision & Action Layer (Incident Copilot)
    CopilotModule,

    // Audit logging (must be after feature modules to intercept their requests)
    AuditModule,

    // Metrics collection and /metrics endpoint
    MetricsModule,

    // Telemetry collection (frontend error reporting)
    TelemetryModule,

    // Dashboard aggregation (composes data from GRC and ITSM modules)
    DashboardModule,

    // Onboarding Core (Suite-first Platform Onboarding)
    OnboardingModule,

    // Platform Core (stub endpoints for dynamic platform features)
    PlatformModule,

    // Admin Core (system visibility, security posture)
    AdminModule,

    // Notifications Foundation (Email + Webhook with audit logging)
    NotificationsModule,

    // Background Jobs Foundation (in-process job runner with registry)
    JobsModule,

    // Todos Module (in-memory demo implementation)
    TodosModule,

    // Rate limiting - Method-based policy:
    // - GET /grc/** list/detail: readLimiter (120/min) - prevents list screen failures
    // - POST/PUT/PATCH/DELETE /grc/**: writeLimiter (30/min) - moderate for mutations
    // - POST /auth/login: authLimiter (10/min) - strict for auth
    // In test environment, use very high limits to avoid blocking E2E tests
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('app.nodeEnv', 'development');
        const isTest = nodeEnv === 'test';
        return [
          {
            name: 'default',
            ttl: 60000, // 60 seconds
            limit: isTest ? 10000 : 100, // High limit in test, 100 in production
          },
          {
            name: 'read',
            ttl: 60000, // 60 seconds
            limit: isTest ? 10000 : 120, // High limit in test, 120/min for GET list/detail
          },
          {
            name: 'write',
            ttl: 60000, // 60 seconds
            limit: isTest ? 10000 : 30, // High limit in test, 30/min for mutations
          },
          {
            name: 'auth',
            ttl: 60000, // 60 seconds
            limit: isTest ? 10000 : 10, // High limit in test, 10/min for auth
          },
        ];
      },
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    StructuredLoggerService,
    // Global exception filter for standard error responses
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // Global rate limiting guard - Method-based throttling
    // Separates rate limits by HTTP method: GET (read), POST/PUT/DELETE (write), auth
    {
      provide: APP_GUARD,
      useClass: MethodBasedThrottlerGuard,
    },
    // Global interceptors for request timing and performance profiling
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestTimingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceInterceptor,
    },
    // Global response transform interceptor for standard success responses
    // Can be disabled in test environment via DISABLE_RESPONSE_ENVELOPE=true
    // This allows tests to receive raw responses without the { success, data } wrapper
    ...(process.env.DISABLE_RESPONSE_ENVELOPE === 'true'
      ? []
      : [
          {
            provide: APP_INTERCEPTOR,
            useClass: ResponseTransformInterceptor,
          },
        ]),
  ],
})
export class AppModule implements NestModule {
  /**
   * Configure middleware for all routes
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(SecurityHeadersMiddleware, CorrelationIdMiddleware)
      .forRoutes('*');
  }
}
