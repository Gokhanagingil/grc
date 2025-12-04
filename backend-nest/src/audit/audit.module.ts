import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';
import { AuditInterceptor } from './audit.interceptor';

/**
 * Audit Module
 *
 * Provides audit logging functionality for the application.
 * Registers a global interceptor that logs all API requests
 * (except health endpoints) to the audit_logs table.
 *
 * Configuration:
 * - NEST_AUDIT_LOG_ENABLED: Set to 'false' to disable audit logging
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [
    AuditService,
    // Register as global interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [AuditService],
})
export class AuditModule {}
