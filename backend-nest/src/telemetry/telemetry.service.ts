import { Injectable } from '@nestjs/common';
import { StructuredLoggerService } from '../common/logger';
import { sanitizeLogData } from '../common/logger/log-sanitizer';
import { FrontendErrorDto } from './dto';

/**
 * Maximum string length for truncation (prevents abuse)
 */
const MAX_STRING_LENGTH = 10000;

/**
 * Dangerous keys that could be used for prototype pollution attacks
 */
const DANGEROUS_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
]);

/**
 * Normalized frontend error data structure
 */
export interface NormalizedFrontendError {
  timestamp: string;
  pathname: string;
  userAgent: string;
  errorName: string;
  errorMessage: string;
  errorStack: string | null;
  componentStack: string | null;
  lastApiEndpoint: string | null;
  url: string | null;
  userId: string | null;
  tenantId: string | null;
  correlationId: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Truncate a string to a maximum length
 */
function truncateString(
  value: string | null | undefined,
  maxLength: number = MAX_STRING_LENGTH,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const str = String(value);
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength) + '... [truncated]';
}

/**
 * Safely set a property on an object using Object.defineProperty
 * This prevents prototype pollution by using explicit property descriptors
 */
function safeSetProperty(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  Object.defineProperty(target, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

/**
 * Sanitize metadata object to prevent prototype pollution
 * Removes dangerous keys and recursively sanitizes nested objects
 * Uses Object.create(null) and Object.defineProperty for safe property assignment
 */
function sanitizeMetadata(
  obj: unknown,
  depth: number = 0,
): Record<string, unknown> | null {
  // Prevent infinite recursion
  if (depth > 10) {
    return null;
  }

  if (obj === null || obj === undefined) {
    return null;
  }

  if (typeof obj !== 'object' || Array.isArray(obj)) {
    return null;
  }

  // Create a prototype-less object to prevent prototype pollution
  const result = Object.create(null) as Record<string, unknown>;
  let hasProperties = false;

  for (const key of Object.keys(obj as Record<string, unknown>)) {
    // Skip dangerous keys
    if (DANGEROUS_KEYS.has(key)) {
      continue;
    }

    // Additional validation: only allow alphanumeric keys with underscores/hyphens
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
      continue;
    }

    const value = (obj as Record<string, unknown>)[key];

    // Recursively sanitize nested objects
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      safeSetProperty(result, key, sanitizeMetadata(value, depth + 1));
      hasProperties = true;
    } else if (typeof value === 'string') {
      // Truncate long strings
      safeSetProperty(result, key, truncateString(value, MAX_STRING_LENGTH));
      hasProperties = true;
    } else if (Array.isArray(value)) {
      // Sanitize arrays (limit size and sanitize elements)
      const sanitizedArray = value.slice(0, 100).map((item: unknown) => {
        if (typeof item === 'string') {
          return truncateString(item, 1000);
        }
        if (item !== null && typeof item === 'object') {
          return sanitizeMetadata(item, depth + 1);
        }
        // Return primitives (number, boolean, null, undefined) as-is
        return item as string | number | boolean | null | undefined;
      });
      safeSetProperty(result, key, sanitizedArray);
      hasProperties = true;
    } else if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      // Keep safe primitives as-is
      safeSetProperty(result, key, value);
      hasProperties = true;
    }
    // Skip any other types (functions, symbols, etc.)
  }

  return hasProperties ? result : null;
}

/**
 * Normalize a frontend error DTO to a consistent structure
 * Handles legacy format, new format, and partial payloads
 *
 * @param dto - The raw frontend error DTO (may be partial or legacy format)
 * @returns Normalized error data with defaults applied
 */
export function normalizeFrontendError(
  dto: FrontendErrorDto,
): NormalizedFrontendError {
  return {
    timestamp: dto.timestamp || new Date().toISOString(),
    pathname: truncateString(dto.pathname, 500) || 'unknown',
    userAgent: truncateString(dto.userAgent, 500) || 'unknown',
    errorName: truncateString(dto.error?.name, 200) || 'Error',
    errorMessage:
      truncateString(dto.error?.message || dto.message, 2000) || 'unknown',
    errorStack: truncateString(
      dto.error?.stack || dto.stack,
      MAX_STRING_LENGTH,
    ),
    componentStack: truncateString(
      dto.error?.componentStack || dto.componentStack,
      MAX_STRING_LENGTH,
    ),
    lastApiEndpoint: truncateString(dto.lastApiEndpoint, 500),
    url: truncateString(dto.url, 2000),
    userId: truncateString(dto.userId, 100),
    tenantId: truncateString(dto.tenantId, 100),
    correlationId: truncateString(dto.correlationId, 100),
    metadata: sanitizeMetadata(dto.metadata),
  };
}

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
   * Log a frontend error with normalization, sanitization, and correlation tracking
   *
   * This method:
   * 1. Normalizes the payload (handles legacy/new/partial formats)
   * 2. Applies defaults for missing fields
   * 3. Sanitizes metadata to prevent prototype pollution
   * 4. Truncates long strings to prevent abuse
   * 5. Double-sanitizes via log-sanitizer for PII protection
   *
   * @param errorPayload - The frontend error payload (may be partial or legacy format)
   * @param correlationId - The correlation ID from the request header (optional)
   * @param tenantId - The tenant ID from the request header (optional)
   */
  logFrontendError(
    errorPayload: FrontendErrorDto,
    correlationId?: string,
    tenantId?: string,
  ): void {
    try {
      // Normalize the payload (handles legacy/new/partial formats)
      const normalized = normalizeFrontendError(errorPayload);

      // Double-sanitize the normalized payload to ensure no sensitive data leaks
      // (frontend should have already sanitized, but we verify server-side)
      const sanitizedPayload = sanitizeLogData(normalized);

      // Log the error with structured metadata
      this.logger.error('Frontend crash reported', {
        correlationId: correlationId || sanitizedPayload.correlationId,
        tenantId: tenantId || sanitizedPayload.tenantId,
        frontendError: {
          timestamp: sanitizedPayload.timestamp,
          pathname: sanitizedPayload.pathname,
          errorName: sanitizedPayload.errorName,
          errorMessage: sanitizedPayload.errorMessage,
          stack: sanitizedPayload.errorStack,
          componentStack: sanitizedPayload.componentStack,
          lastApiEndpoint: sanitizedPayload.lastApiEndpoint,
          userAgent: sanitizedPayload.userAgent,
          url: sanitizedPayload.url,
          userId: sanitizedPayload.userId,
          metadata: sanitizedPayload.metadata,
        },
      });
    } catch (error) {
      // Even if logging fails, we don't want to propagate the error
      // Telemetry should never break the client
      this.logger.warn('Failed to log frontend error', {
        error: error instanceof Error ? error.message : String(error),
        correlationId,
        tenantId,
      });
    }
  }
}
