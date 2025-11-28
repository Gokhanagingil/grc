import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

/**
 * Logging Interceptor
 * Logs request/response with structured data (works with or without Pino)
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, headers } = request;
    const requestId = (request as any).requestId || 'unknown';
    const tenantId = headers['x-tenant-id'] || 'unknown';
    const userId = (request as any).user?.id || 'anonymous';

    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: (data) => {
          const response = context.switchToHttp().getResponse();
          const duration = Date.now() - start;

          // Structured log (JSON format for Pino compatibility)
          const logData = {
            timestamp: new Date().toISOString(),
            level: 'info',
            msg: `${method} ${url} ${response.statusCode}`,
            'req.id': requestId,
            tenantId,
            userId,
            method,
            url,
            status: response.statusCode,
            duration_ms: duration,
          };

          this.logger.log(JSON.stringify(logData));
        },
        error: (error) => {
          const duration = Date.now() - start;
          const status = error?.status || 500;

          const logData = {
            timestamp: new Date().toISOString(),
            level: 'error',
            msg: `${method} ${url} ${status} - ${error?.message || 'Unknown error'}`,
            'req.id': requestId,
            tenantId,
            userId,
            method,
            url,
            status,
            duration_ms: duration,
            error: error?.message || 'Unknown error',
          };

          this.logger.error(JSON.stringify(logData));
        },
      }),
    );
  }
}
