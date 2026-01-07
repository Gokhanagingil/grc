import { Controller, Post, Body, Headers } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { TelemetryService } from './telemetry.service';
import { FrontendErrorDto } from './dto';
import { Public } from '../auth/decorators';

/**
 * Telemetry Controller
 *
 * Provides endpoints for receiving telemetry data from the frontend.
 * These endpoints are designed to be lightweight and fire-and-forget.
 *
 * Security considerations:
 * - No authentication required (errors may occur before auth)
 * - Rate limiting is skipped to avoid blocking error reports
 * - All data is sanitized server-side before logging
 * - No sensitive data should be stored or transmitted
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
   * This endpoint receives sanitized error reports from the frontend
   * ErrorBoundary components. The data is logged with correlation ID
   * for debugging purposes.
   *
   * @param errorPayload - The sanitized error payload
   * @param correlationId - The correlation ID from the request header
   * @param tenantId - The tenant ID from the request header
   * @returns Acknowledgment of receipt
   */
  @Post('frontend-error')
  reportFrontendError(
    @Body() errorPayload: FrontendErrorDto,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-tenant-id') tenantId?: string,
  ): { received: boolean } {
    // Log the error (fire-and-forget, no need to await)
    this.telemetryService.logFrontendError(
      errorPayload,
      correlationId,
      tenantId,
    );

    // Always return success to avoid blocking the frontend
    return { received: true };
  }
}

/**
 * API Telemetry Controller
 *
 * Duplicate controller to handle /api/telemetry/* routes.
 * This is needed because nginx proxies /api/* to the backend,
 * so the frontend posts to /api/telemetry/frontend-error.
 */
@Controller('api/telemetry')
@SkipThrottle()
@Public()
export class ApiTelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post('frontend-error')
  reportFrontendError(
    @Body() errorPayload: FrontendErrorDto,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-tenant-id') tenantId?: string,
  ): { received: boolean } {
    this.telemetryService.logFrontendError(
      errorPayload,
      correlationId,
      tenantId,
    );
    return { received: true };
  }
}
