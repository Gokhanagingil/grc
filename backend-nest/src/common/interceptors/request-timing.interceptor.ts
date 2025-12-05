import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { StructuredLoggerService } from '../logger/structured-logger.service';
import { MetricsService } from '../../metrics/metrics.service';

/**
 * Request Timing Interceptor
 *
 * Measures request latency and logs structured completion events.
 * Also records metrics for the /metrics endpoint.
 */
@Injectable()
export class RequestTimingInterceptor implements NestInterceptor {
  private readonly logger = new StructuredLoggerService();

  constructor(private readonly metricsService: MetricsService) {
    this.logger.setContext('RequestTimingInterceptor');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const startTime = request.requestStartTime || Date.now();
    const method = request.method;
    const path = request.route?.path || request.path;

    return next.handle().pipe(
      tap({
        next: () => {
          const latencyMs = Date.now() - startTime;
          const statusCode = response.statusCode;

          // Log structured request completion
          this.logger.logRequest(statusCode, latencyMs, {
            route: path,
            contentLength: response.get('content-length'),
          });

          // Record metrics
          this.metricsService.recordRequest(method, path, statusCode, latencyMs);
        },
        error: (error) => {
          const latencyMs = Date.now() - startTime;
          const statusCode = error.status || error.statusCode || 500;

          // Log structured error
          this.logger.error('request.failed', {
            error,
            latencyMs,
            statusCode,
            route: path,
          });

          // Record error metrics
          this.metricsService.recordRequest(method, path, statusCode, latencyMs);
          this.metricsService.recordError(method, path, statusCode);
        },
      }),
    );
  }
}
