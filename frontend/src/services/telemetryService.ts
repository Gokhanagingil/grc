/**
 * Telemetry Service
 *
 * Provides lightweight client-side crash telemetry for ErrorBoundary
 * to speed up staging debugging without exposing sensitive data.
 *
 * Features:
 * - Tracks last API endpoint called (for debugging context)
 * - Sends sanitized error reports to backend
 * - Includes correlation ID if available
 * - Safe by default - no PII/secrets transmitted
 */

import { createSanitizedErrorPayload } from '../utils/errorSanitizer';

/**
 * Frontend error telemetry payload
 */
export interface FrontendErrorPayload {
  timestamp: string;
  pathname: string;
  error: {
    name: string;
    message: string;
    stack: string;
    componentStack: string;
  };
  lastApiEndpoint?: string;
  userAgent: string;
  correlationId?: string;
}

/**
 * Tracks the last API endpoint called for debugging context
 */
let lastApiEndpoint: string | undefined;

/**
 * Tracks the correlation ID from the last API response
 */
let lastCorrelationId: string | undefined;

/**
 * Record an API call for telemetry context
 *
 * @param endpoint - The API endpoint that was called
 * @param correlationId - The correlation ID from the response (optional)
 */
export function recordApiCall(
  endpoint: string,
  correlationId?: string
): void {
  lastApiEndpoint = endpoint;
  if (correlationId) {
    lastCorrelationId = correlationId;
  }
}

/**
 * Get the last recorded API endpoint
 */
export function getLastApiEndpoint(): string | undefined {
  return lastApiEndpoint;
}

/**
 * Get the last correlation ID
 */
export function getLastCorrelationId(): string | undefined {
  return lastCorrelationId;
}

/**
 * Clear telemetry context (useful for testing or logout)
 */
export function clearTelemetryContext(): void {
  lastApiEndpoint = undefined;
  lastCorrelationId = undefined;
}

/**
 * Send frontend error telemetry to the backend
 *
 * This function is designed to be fire-and-forget - it will not throw
 * errors or block the UI. Telemetry failures are silently logged to console.
 *
 * @param error - The error that occurred
 * @param errorInfo - React error info with component stack (optional)
 */
export async function sendErrorTelemetry(
  error: Error,
  errorInfo?: { componentStack?: string | null }
): Promise<void> {
  try {
    const sanitizedError = createSanitizedErrorPayload(error, errorInfo);

    const payload: FrontendErrorPayload = {
      timestamp: new Date().toISOString(),
      pathname: typeof window !== 'undefined' ? window.location.pathname : '',
      error: sanitizedError,
      lastApiEndpoint: lastApiEndpoint,
      userAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      correlationId: lastCorrelationId,
    };

    // Get the API base URL from environment or default
    const apiBaseUrl =
      process.env.REACT_APP_API_URL || '/api';

    // Fire-and-forget POST to telemetry endpoint
    // Using fetch directly to avoid circular dependencies with api.ts
    const response = await fetch(`${apiBaseUrl}/telemetry/frontend-error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Include tenant ID if available
        ...(localStorage.getItem('tenantId')
          ? { 'x-tenant-id': localStorage.getItem('tenantId') || '' }
          : {}),
        // Include correlation ID if available
        ...(lastCorrelationId
          ? { 'x-correlation-id': lastCorrelationId }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn(
        '[Telemetry] Failed to send error telemetry:',
        response.status
      );
    }
  } catch (telemetryError) {
    // Silently log telemetry failures - don't disrupt user experience
    console.warn('[Telemetry] Error sending telemetry:', telemetryError);
  }
}
