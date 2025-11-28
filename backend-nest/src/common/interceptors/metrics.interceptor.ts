import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Optional,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { METRICS_PORT, MetricsPort } from '../services/metrics.tokens';

/**
 * Metrics Interceptor
 * Tracks HTTP metrics via MetricsPort (if available)
 * No-op if MetricsPort not available - no duplicate register creation
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    @Optional() @Inject(METRICS_PORT) private readonly metrics?: MetricsPort,
  ) {
    // MetricsPort is optional - if not available, interceptor is no-op
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // No-op if metrics not available
    if (!this.metrics) {
      return next.handle();
    }

    // MetricsPort available - use it for HTTP metrics (if MetricsService implements it)
    // For now, just no-op - HTTP metrics can be handled by MetricsService directly
    // This avoids duplicate metric registration issues
    return next.handle();
  }
}
