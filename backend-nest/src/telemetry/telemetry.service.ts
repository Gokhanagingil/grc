import { Injectable } from '@nestjs/common';
import { StructuredLoggerService } from '../common/logger';
import { sanitizeLogData } from '../common/logger/log-sanitizer';
import { FrontendErrorDto } from './dto';

/**
 * Telemetry Service
 *
 * Handles frontend error telemetry logging with proper sanitization
 * and correlation ID tracking for debugging.
 */
@Injectable()
export class TelemetryService {
  private readonly logger: StructuredLoggerService;

  constructor() {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('TelemetryService');
  }

  /**
   * Log a frontend error with sanitization and correlation tracking
   *
   * @param errorPayload - The sanitized error payload from the frontend
   * @param correlationId - The correlation ID from the request (optional)
   * @param tenantId - The tenant ID from the request (optional)
   */
  logFrontendError(
    errorPayload: FrontendErrorDto,
    correlationId?: string,
    tenantId?: string,
  ): void {
    // Double-sanitize the payload to ensure no sensitive data leaks
    // (frontend should have already sanitized, but we verify server-side)
    const sanitizedPayload = sanitizeLogData(errorPayload);

    // Log the error with structured metadata
    this.logger.error('Frontend crash reported', {
      correlationId: correlationId || sanitizedPayload.correlationId,
      tenantId,
      frontendError: {
        timestamp: sanitizedPayload.timestamp,
        pathname: sanitizedPayload.pathname,
        errorName: sanitizedPayload.error?.name,
        errorMessage: sanitizedPayload.error?.message,
        stack: sanitizedPayload.error?.stack,
        componentStack: sanitizedPayload.error?.componentStack,
        lastApiEndpoint: sanitizedPayload.lastApiEndpoint,
        userAgent: sanitizedPayload.userAgent,
      },
    });
  }
}
