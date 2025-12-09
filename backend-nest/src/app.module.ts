import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { configuration, validate } from './config';
import { EventsModule } from './events/events.module';
import { AuditModule } from './audit/audit.module';
import { SettingsModule } from './settings/settings.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { GrcModule } from './grc/grc.module';
import { MetricsModule } from './metrics/metrics.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  CorrelationIdMiddleware,
  SecurityHeadersMiddleware,
} from './common/middleware';
import {
  RequestTimingInterceptor,
  PerformanceInterceptor,
} from './common/interceptors';
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
        const dbSync = configService.get<boolean>('db.synchronize', false);
        const nodeEnv = configService.get<string>('app.nodeEnv', 'development');

        return {
          type: 'postgres',
          host: dbHost,
          port: dbPort,
          username: dbUser,
          password: dbPassword,
          database: dbName,
          autoLoadEntities: true,
          // WARNING: synchronize should be false in production!
          // It auto-creates/updates tables based on entities.
          synchronize: dbSync,
          logging: nodeEnv === 'development',
        };
      },
    }),

    // Event bus (must be before modules that emit events)
    EventsModule,

    // Feature modules
    HealthModule,
    UsersModule,
    AuthModule,
    TenantsModule,
    SettingsModule,

    // GRC Domain Model (Risk, Control, Policy, Requirement, Issue, CAPA, Evidence)
    GrcModule,

    // Audit logging (must be after feature modules to intercept their requests)
    AuditModule,

    // Metrics collection and /metrics endpoint
    MetricsModule,

    // Rate limiting - default: 100 requests per 60 seconds
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
            name: 'strict',
            ttl: 60000, // 60 seconds
            limit: isTest ? 10000 : 10, // High limit in test, 10 in production
          },
        ];
      },
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    StructuredLoggerService,
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
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
