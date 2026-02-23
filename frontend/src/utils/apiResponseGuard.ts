/**
 * API Response Shape Guard Utility
 *
 * Phase 0 — Quality Gate: "No silent UI failures"
 *
 * Lightweight guard that detects unexpected API response shapes and surfaces
 * explicit errors instead of allowing blank screens or infinite spinners.
 *
 * Usage in critical screens:
 *   const data = guardListResponse<MyItem>(response, 'ChangeList');
 *   const record = guardRecordResponse<MyRecord>(response, 'RcaDecisions');
 *
 * If the shape is unexpected, the guard:
 *   1. Logs a structured warning with correlation id (if available)
 *   2. Returns a safe fallback value (empty array / null)
 *   3. Sets a shapeMismatch flag that the UI can use to show a banner
 *
 * @module apiResponseGuard
 */

import { classifyApiError } from './apiErrorClassifier';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface GuardedListResult<T> {
  items: T[];
  total: number;
  /** True when the response shape was unexpected and a fallback was used */
  shapeMismatch: boolean;
  /** Human-readable description of the mismatch (empty if no mismatch) */
  mismatchDetail: string;
  /** Correlation ID from response headers, if available */
  correlationId: string | null;
}

export interface GuardedRecordResult<T> {
  data: T | null;
  /** True when the response shape was unexpected and a fallback was used */
  shapeMismatch: boolean;
  /** Human-readable description of the mismatch (empty if no mismatch) */
  mismatchDetail: string;
  /** Correlation ID from response headers, if available */
  correlationId: string | null;
}

export interface ShapeMismatchEvent {
  screen: string;
  expected: string;
  received: string;
  correlationId: string | null;
  timestamp: string;
}

/* ------------------------------------------------------------------ */
/* Mismatch event bus (lightweight pub/sub for banner display)         */
/* ------------------------------------------------------------------ */

type MismatchListener = (event: ShapeMismatchEvent) => void;
const listeners: MismatchListener[] = [];

/**
 * Subscribe to shape mismatch events.
 * Returns an unsubscribe function.
 */
export function onShapeMismatch(listener: MismatchListener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function emitMismatch(event: ShapeMismatchEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Listener errors must not break the guard
    }
  }
}

/* ------------------------------------------------------------------ */
/* Correlation ID extraction                                           */
/* ------------------------------------------------------------------ */

/**
 * Extract correlation ID from response headers or body.
 * Checks common header names used in the GRC platform.
 */
export function extractCorrelationId(
  headers?: Record<string, string> | null,
  body?: Record<string, unknown> | null,
): string | null {
  if (headers) {
    const candidates = [
      'x-correlation-id',
      'x-request-id',
      'x-trace-id',
      'correlation-id',
      'request-id',
    ];
    for (const key of candidates) {
      const val = headers[key];
      if (typeof val === 'string' && val.length > 0) return val;
    }
  }
  if (body) {
    if (typeof body.correlationId === 'string') return body.correlationId;
    if (typeof body.requestId === 'string') return body.requestId;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Guards                                                              */
/* ------------------------------------------------------------------ */

/**
 * Guard a LIST-CONTRACT response.
 *
 * Expected shape: { items: T[], total: number, page, pageSize, totalPages }
 * Also accepts: T[] (flat array) or { data: T[] } or { success: true, data: { items: T[] } }
 *
 * If the shape is unexpected, returns empty items[] and sets shapeMismatch = true.
 */
export function guardListResponse<T>(
  responseData: unknown,
  screen: string,
  correlationId?: string | null,
): GuardedListResult<T> {
  const corrId = correlationId ?? null;

  // Already a LIST-CONTRACT object with items array
  if (
    responseData &&
    typeof responseData === 'object' &&
    !Array.isArray(responseData)
  ) {
    const obj = responseData as Record<string, unknown>;

    // Unwrap NestJS envelope: { success: true, data: ... }
    if (obj.success === true && obj.data != null) {
      return guardListResponse<T>(obj.data, screen, corrId);
    }

    // LIST-CONTRACT: { items: [...], total, ... }
    if (Array.isArray(obj.items)) {
      return {
        items: obj.items as T[],
        total: typeof obj.total === 'number' ? obj.total : (obj.items as T[]).length,
        shapeMismatch: false,
        mismatchDetail: '',
        correlationId: corrId,
      };
    }
  }

  // Flat array
  if (Array.isArray(responseData)) {
    return {
      items: responseData as T[],
      total: (responseData as T[]).length,
      shapeMismatch: false,
      mismatchDetail: '',
      correlationId: corrId,
    };
  }

  // Unexpected shape
  const receivedType = responseData === null
    ? 'null'
    : responseData === undefined
      ? 'undefined'
      : Array.isArray(responseData)
        ? 'array'
        : typeof responseData;

  const detail = `Expected LIST-CONTRACT (items[]) but received ${receivedType} on ${screen}`;

  // eslint-disable-next-line no-console
  console.warn(`[apiResponseGuard] ${detail}`, { correlationId: corrId, responseData });

  emitMismatch({
    screen,
    expected: 'LIST-CONTRACT (items[])',
    received: receivedType,
    correlationId: corrId,
    timestamp: new Date().toISOString(),
  });

  return {
    items: [],
    total: 0,
    shapeMismatch: true,
    mismatchDetail: detail,
    correlationId: corrId,
  };
}

/**
 * Guard a RECORD-CONTRACT response (single object).
 *
 * Expected: a non-null, non-array object with at least one expected key.
 * Also accepts: { success: true, data: T }
 *
 * If the shape is unexpected, returns data = null and sets shapeMismatch = true.
 */
export function guardRecordResponse<T>(
  responseData: unknown,
  screen: string,
  requiredKeys: string[] = [],
  correlationId?: string | null,
): GuardedRecordResult<T> {
  const corrId = correlationId ?? null;

  if (
    responseData &&
    typeof responseData === 'object' &&
    !Array.isArray(responseData)
  ) {
    const obj = responseData as Record<string, unknown>;

    // Unwrap NestJS envelope
    if (obj.success === true && obj.data != null) {
      return guardRecordResponse<T>(obj.data, screen, requiredKeys, corrId);
    }

    // Check required keys if specified
    if (requiredKeys.length > 0) {
      const missingKeys = requiredKeys.filter((k) => !(k in obj));
      if (missingKeys.length > 0) {
        const detail = `Record missing required keys [${missingKeys.join(', ')}] on ${screen}`;

        // eslint-disable-next-line no-console
        console.warn(`[apiResponseGuard] ${detail}`, { correlationId: corrId });

        emitMismatch({
          screen,
          expected: `Record with keys [${requiredKeys.join(', ')}]`,
          received: `Record missing [${missingKeys.join(', ')}]`,
          correlationId: corrId,
          timestamp: new Date().toISOString(),
        });

        return {
          data: null,
          shapeMismatch: true,
          mismatchDetail: detail,
          correlationId: corrId,
        };
      }
    }

    return {
      data: responseData as T,
      shapeMismatch: false,
      mismatchDetail: '',
      correlationId: corrId,
    };
  }

  // Unexpected shape
  const receivedType = responseData === null
    ? 'null'
    : responseData === undefined
      ? 'undefined'
      : Array.isArray(responseData)
        ? 'array'
        : typeof responseData;

  const detail = `Expected RECORD-CONTRACT (object) but received ${receivedType} on ${screen}`;

  // eslint-disable-next-line no-console
  console.warn(`[apiResponseGuard] ${detail}`, { correlationId: corrId });

  emitMismatch({
    screen,
    expected: 'RECORD-CONTRACT (object)',
    received: receivedType,
    correlationId: corrId,
    timestamp: new Date().toISOString(),
  });

  return {
    data: null,
    shapeMismatch: true,
    mismatchDetail: detail,
    correlationId: corrId,
  };
}

/**
 * Handle an API error using classifyApiError and return a user-friendly result.
 *
 * Key policy:
 *   - 401 → shouldLogout = true
 *   - 403 → shouldLogout = false (NEVER auto-logout)
 *   - unexpected shape → banner, not crash
 */
export function handleApiError(
  error: unknown,
  screen: string,
): { message: string; shouldLogout: boolean; isRetryable: boolean } {
  const classified = classifyApiError(error);
  return {
    message: classified.message,
    shouldLogout: classified.shouldLogout,
    isRetryable: classified.isRetryable,
  };
}
