import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';
import { StructuredLoggerService } from '../logger/structured-logger.service';
import { MetricsService } from '../../metrics/metrics.service';
import { RequestWithUser } from '../types';

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

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<
      RequestWithUser & { requestStartTime?: number; route?: { path?: string } }
    >();
    const response = ctx.getResponse<Response>();

        const startTime = request.requestStartTime || Date.now();
        const method = request.method;
        // Extract route path safely - Express route.path can be any type
        const route = request.route as { path?: unknown } | undefined;
        const routePath: string =
          typeof route?.path === 'string' ? route.path : request.url ?? '/';

    return next.handle().pipe(
      tap({
        next: () => {
          const latencyMs = Date.now() - startTime;
          const statusCode = response.statusCode;

          // Log structured request completion
          this.logger.logRequest(statusCode, latencyMs, {
            route: routePath,
            contentLength: response.get('content-length'),
          });

          // Record metrics
          this.metricsService.recordRequest(
            method,
            routePath,
            statusCode,
            latencyMs,
          );
        },
        error: (error: unknown) => {
          const latencyMs = Date.now() - startTime;
          let statusCode = 500;
          if (error instanceof HttpException) {
            statusCode = error.getStatus();
          } else if (typeof error === 'object' && error !== null) {
            const errorObj = error as { status?: number; statusCode?: number };
            statusCode = errorObj.status || errorObj.statusCode || 500;
          }

          // Log structured error
          this.logger.error('request.failed', {
            error,
            latencyMs,
            statusCode,
            route: routePath,
          });

          // Record error metrics
          this.metricsService.recordRequest(
            method,
            routePath,
            statusCode,
            latencyMs,
          );
          this.metricsService.recordError(method, routePath, statusCode);
        },
      }),
    );
  }
}
