import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../../entities/audit/audit-log.entity';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly auditEnabled: boolean;
  private readonly isDev: boolean;

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepo: Repository<AuditLogEntity>,
    private readonly config: ConfigService,
  ) {
    // Check if audit logging is enabled (default: true)
    // Can be disabled with AUDIT_LOG_ENABLED=false in .env
    this.auditEnabled =
      this.config.get<string>('AUDIT_LOG_ENABLED', 'true') !== 'false';
    this.isDev = process.env.NODE_ENV !== 'production';
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Early return if audit logging is disabled
    if (!this.auditEnabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;

    // Only log write operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const before = JSON.parse(JSON.stringify(request.body || {}));

    // Mask PII
    const maskPII = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      const masked = { ...obj };
      const piiFields = ['email', 'phone', 'password', 'password_hash'];
      for (const field of piiFields) {
        if (masked[field]) {
          masked[field] = '***MASKED***';
        }
      }
      return masked;
    };

    return next.handle().pipe(
      tap(async (after) => {
        try {
          const actorId = request.user?.userId || request.user?.sub || null;
          const tenantId = request.tenantId || request.user?.tenantId || null;
          const entity =
            url.split('/').filter(Boolean).slice(-2)[0] || 'unknown';
          const entityId = request.params?.id || after?.id || null;

          // Prepare diff object
          const diffObj = {
            before: maskPII(before),
            after: maskPII(after),
          };

          // Don't manually set id - let BeforeInsert hook generate UUID
          // This ensures compatibility with both SQLite and PostgreSQL
          // The entity's jsonTransformer will handle serialization automatically
          const auditLog = this.auditLogRepo.create({
            tenant_id: tenantId || undefined,
            user_id: actorId || undefined,
            entity_schema: 'app',
            entity_table: entity,
            entity_id: entityId || undefined,
            action: method.toLowerCase(),
            // Pass as object - entity's transformer will serialize to JSON string
            diff: diffObj,
          });
          await this.auditLogRepo.save(auditLog);
        } catch (error) {
          // Log but don't fail the request - audit logging is best-effort
          // Extract error message
          const errorMsg =
            error instanceof Error
              ? error.message
              : String(error);
          
          // Check if this is a known schema mismatch issue
          const isSchemaMismatch =
            errorMsg.includes('SQLITE_MISMATCH') ||
            errorMsg.includes('datatype mismatch') ||
            errorMsg.includes('SQLITE_CONSTRAINT');
          
          // In dev, use shorter, less noisy error messages
          if (this.isDev) {
            if (isSchemaMismatch) {
              // For schema mismatch errors, log once with minimal noise
              // These are usually one-time issues that get resolved by table recreation
              console.warn(
                `[AuditLog] Schema mismatch (dev) - audit log not persisted. Table may need recreation.`,
              );
            } else {
              // For other errors, log with truncated message
              console.warn(
                `[AuditLog] Failed to persist audit log (dev): ${errorMsg.substring(0, 150)}`,
              );
            }
          } else {
            // In production, log more details but still keep it concise
            if (isSchemaMismatch) {
              console.error('[AuditLog] Schema mismatch - audit log not persisted:', errorMsg);
            } else {
              console.error('[AuditLog] Failed to write audit log:', errorMsg);
              if (error instanceof Error && error.stack) {
                console.error('[AuditLog] Stack trace:', error.stack.substring(0, 200));
              }
            }
          }
        }
      }),
    );
  }
}
