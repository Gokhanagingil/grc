import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../../entities/audit/audit-log.entity';
import * as uuid from 'uuid';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepo: Repository<AuditLogEntity>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
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
          const entity = url.split('/').filter(Boolean).slice(-2)[0] || 'unknown';
          const entityId = request.params?.id || after?.id || null;
          
          await this.auditLogRepo.save({
            id: uuid.v4(),
            tenant_id: tenantId,
            user_id: actorId,
            entity_schema: 'app',
            entity_table: entity,
            entity_id: entityId,
            action: method.toLowerCase(),
            diff: {
              before: maskPII(before),
              after: maskPII(after),
            },
            created_at: new Date(),
          });
        } catch (error) {
          // Log but don't fail the request
          console.error('Audit log failed:', error);
        }
      }),
    );
  }
}

