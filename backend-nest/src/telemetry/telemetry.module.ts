import { Module } from '@nestjs/common';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';

/**
 * Telemetry Module
 *
 * Provides lightweight client-side crash telemetry endpoints for
 * frontend ErrorBoundary components to speed up staging debugging
 * without exposing sensitive data.
 *
 * Features:
 * - Receives sanitized error reports from frontend
 * - Logs errors with correlation ID for debugging
 * - Double-sanitizes data server-side for safety
 * - No authentication required (errors may occur before auth)
 * - Rate limiting skipped to avoid blocking error reports
 *
 * Endpoints:
 * - POST /telemetry/frontend-error - Receive frontend error telemetry
 */
@Module({
  controllers: [TelemetryController],
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class TelemetryModule {}
