import { Controller, Post, Body, Headers, HttpCode } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { TelemetryService } from './telemetry.service';
import { FrontendErrorDto } from './dto';
import { Public } from '../auth/decorators';

/**
 * Standard telemetry response format
 * Always returns success to avoid blocking the frontend
 */
interface TelemetryResponse {
  success: boolean;
  message: string;
}

/**
 * Telemetry Controller
 *
 * Provides endpoints for receiving telemetry data from the frontend.
 * These endpoints are designed to be lightweight and fire-and-forget.
 *
 * Key behaviors:
 * - Always returns HTTP 200 OK (telemetry must never fail)
 * - Accepts legacy format: { message, stack }
 * - Accepts new format: { error: { name, message, stack } }
 * - Accepts partial/empty payloads (defaults applied server-side)
 * - Normalizes and sanitizes all data server-side
 *
 * Security considerations:
 * - No authentication required (errors may occur before auth)
 * - Rate limiting is skipped to avoid blocking error reports
 * - All data is sanitized server-side before logging
 * - Metadata is sanitized to prevent prototype pollution
 * - Long strings are truncated to prevent abuse
 */
@Controller('telemetry')
@SkipThrottle()
@Public()
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  /**
   * Receive frontend error telemetry
   *
   * POST /telemetry/frontend-error
   *
   * This endpoint receives error reports from the frontend ErrorBoundary
   * components. It accepts multiple payload formats for backward compatibility:
   * - Legacy: { message, stack }
   * - New: { error: { name, message, stack } }
   * - Full: { timestamp, pathname, userAgent, error: {...} }
   * - Partial/empty payloads (defaults applied)
   *
   * The endpoint ALWAYS returns 200 OK to avoid blocking the frontend.
   * Even if logging fails internally, the response is still successful.
   *
   * @param errorPayload - The error payload (may be partial or legacy format)
   * @param correlationId - The correlation ID from the request header
   * @param tenantId - The tenant ID from the request header
   * @returns Standard success response
   */
  @Post('frontend-error')
  @HttpCode(200)
  reportFrontendError(
    @Body() errorPayload: FrontendErrorDto,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-tenant-id') tenantId?: string,
  ): TelemetryResponse {
    // Log the error (fire-and-forget, no need to await)
    // The service handles all normalization, sanitization, and error handling
    this.telemetryService.logFrontendError(
      errorPayload,
      correlationId,
      tenantId,
    );

    // Always return success to avoid blocking the frontend
    return { success: true, message: 'Error reported successfully' };
  }
}

/**
 * API Telemetry Controller
 *
 * Duplicate controller to handle /api/telemetry/* routes.
 * This is needed because nginx proxies /api/* to the backend,
 * so the frontend posts to /api/telemetry/frontend-error.
 *
 * Behavior is identical to TelemetryController.
 */
@Controller('api/telemetry')
@SkipThrottle()
@Public()
export class ApiTelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post('frontend-error')
  @HttpCode(200)
  reportFrontendError(
    @Body() errorPayload: FrontendErrorDto,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-tenant-id') tenantId?: string,
  ): TelemetryResponse {
    this.telemetryService.logFrontendError(
      errorPayload,
      correlationId,
      tenantId,
    );
    return { success: true, message: 'Error reported successfully' };
  }
}
