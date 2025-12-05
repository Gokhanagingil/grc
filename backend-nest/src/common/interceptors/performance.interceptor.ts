import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { StructuredLoggerService } from '../logger/structured-logger.service';
import { PERF_METADATA_KEY } from '../decorators/perf.decorator';

/**
 * Performance Interceptor
 *
 * Provides detailed performance profiling for methods decorated with @Perf().
 * Logs handler execution time, correlation ID, path, and outcome.
 */
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new StructuredLoggerService();

  constructor(private readonly reflector: Reflector) {
    this.logger.setContext('PerformanceInterceptor');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Check if @Perf() decorator is applied
    const isPerfEnabled = this.reflector.get<boolean>(
      PERF_METADATA_KEY,
      context.getHandler(),
    );

    if (!isPerfEnabled) {
      return next.handle();
    }

    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const handlerName = `${context.getClass().name}.${context.getHandler().name}`;
    const startTime = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: (data) => {
          const endTime = process.hrtime.bigint();
          const durationMs = Number(endTime - startTime) / 1_000_000;

          this.logger.log('perf.handler.completed', {
            handler: handlerName,
            durationMs: Math.round(durationMs * 100) / 100,
            correlationId: request.correlationId,
            path: request.path,
            method: request.method,
            outcome: 'success',
            responseSize: data ? JSON.stringify(data).length : 0,
          });
        },
        error: (error) => {
          const endTime = process.hrtime.bigint();
          const durationMs = Number(endTime - startTime) / 1_000_000;

          this.logger.warn('perf.handler.failed', {
            handler: handlerName,
            durationMs: Math.round(durationMs * 100) / 100,
            correlationId: request.correlationId,
            path: request.path,
            method: request.method,
            outcome: 'error',
            errorName: error.name,
            errorMessage: error.message,
          });
        },
      }),
    );
  }
}
