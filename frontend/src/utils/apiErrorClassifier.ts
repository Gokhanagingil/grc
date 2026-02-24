/**
 * API Error Classification Utility
 *
 * Centralizes error classification for consistent handling across the platform.
 * Prevents false "session expired" UX by distinguishing auth errors from
 * authorization (forbidden) and other error types.
 */

import { AxiosError } from 'axios';

export type ApiErrorKind =
  | 'auth'        // 401 - token invalid/expired → may trigger session-expired flow
  | 'forbidden'   // 403 - permission denied → show in-page error, NEVER logout
  | 'validation'  // 400/422 - bad request / validation error
  | 'not_found'   // 404
  | 'conflict'    // 409
  | 'rate_limit'  // 429
  | 'server'      // 500+ - server error
  | 'network'     // no response - network/timeout error
  | 'unknown';    // unclassified

export interface ClassifiedApiError {
  kind: ApiErrorKind;
  status: number | null;
  message: string;
  isRetryable: boolean;
  /** True only for genuine auth expiry (401). NEVER true for 403. */
  shouldLogout: boolean;
  /** Original error for further inspection */
  original: unknown;
}

/**
 * Classify an API error into a structured, actionable object.
 *
 * Key policy decisions:
 * - 401 Unauthorized → `auth` kind, `shouldLogout = true`
 * - 403 Forbidden → `forbidden` kind, `shouldLogout = false` (NEVER auto-logout)
 * - 400/422 → `validation`, show user-facing message
 * - 500+ → `server`, retryable
 * - No response → `network`, retryable
 */
export function classifyApiError(error: unknown): ClassifiedApiError {
  // Handle AxiosError with response
  if (isAxiosError(error) && error.response) {
    const status = error.response.status;
    const data = error.response.data as Record<string, unknown> | undefined;

    // Extract message from various response shapes
    const message = extractErrorMessage(data, error.message);

    if (status === 401) {
      return {
        kind: 'auth',
        status,
        message: message || 'Session expired. Please log in again.',
        isRetryable: false,
        shouldLogout: true,
        original: error,
      };
    }

    if (status === 403) {
      return {
        kind: 'forbidden',
        status,
        message: message || 'You do not have permission to perform this action.',
        isRetryable: false,
        shouldLogout: false, // NEVER logout on 403
        original: error,
      };
    }

    if (status === 400 || status === 422) {
      return {
        kind: 'validation',
        status,
        message: message || 'Invalid request. Please check your input.',
        isRetryable: false,
        shouldLogout: false,
        original: error,
      };
    }

    if (status === 404) {
      return {
        kind: 'not_found',
        status,
        message: message || 'The requested resource was not found.',
        isRetryable: false,
        shouldLogout: false,
        original: error,
      };
    }

    if (status === 409) {
      return {
        kind: 'conflict',
        status,
        message: message || 'A conflict occurred. Please retry.',
        isRetryable: true,
        shouldLogout: false,
        original: error,
      };
    }

    if (status === 429) {
      return {
        kind: 'rate_limit',
        status,
        message: message || 'Too many requests. Please wait and try again.',
        isRetryable: true,
        shouldLogout: false,
        original: error,
      };
    }

    if (status >= 500) {
      return {
        kind: 'server',
        status,
        message: message || 'A server error occurred. Please try again later.',
        isRetryable: true,
        shouldLogout: false,
        original: error,
      };
    }

    // Fallback for other status codes
    return {
      kind: 'unknown',
      status,
      message: message || 'An unexpected error occurred.',
      isRetryable: false,
      shouldLogout: false,
      original: error,
    };
  }

  // AxiosError without response (network error, timeout)
  if (isAxiosError(error) && !error.response) {
    return {
      kind: 'network',
      status: null,
      message: error.code === 'ECONNABORTED'
        ? 'Request timed out. Please check your connection.'
        : 'Network error. Please check your connection.',
      isRetryable: true,
      shouldLogout: false,
      original: error,
    };
  }

  // Generic Error
  if (error instanceof Error) {
    return {
      kind: 'unknown',
      status: null,
      message: error.message || 'An unexpected error occurred.',
      isRetryable: false,
      shouldLogout: false,
      original: error,
    };
  }

  // Unknown error shape
  return {
    kind: 'unknown',
    status: null,
    message: 'An unexpected error occurred.',
    isRetryable: false,
    shouldLogout: false,
    original: error,
  };
}

/**
 * Type guard for AxiosError
 */
function isAxiosError(error: unknown): error is AxiosError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as AxiosError).isAxiosError === true
  );
}

/**
 * Extract a human-readable message from various error response shapes.
 * Handles:
 * - { error: { message } } (NestJS GlobalExceptionFilter)
 * - { message } (flat)
 * - { message: string[] } (class-validator array)
 */
function extractErrorMessage(
  data: Record<string, unknown> | undefined,
  fallback: string,
): string {
  if (!data) return fallback;

  // NestJS error envelope: { success: false, error: { message, fieldErrors } }
  if (data.error && typeof data.error === 'object') {
    const err = data.error as Record<string, unknown>;
    if (typeof err.message === 'string') return err.message;
    // Field errors
    if (Array.isArray(err.fieldErrors) && err.fieldErrors.length > 0) {
      return (err.fieldErrors as Array<{ field: string; message: string }>)
        .map((fe) => `${fe.field}: ${fe.message}`)
        .join(', ');
    }
  }

  // ChoiceService validation: { error: 'INVALID_CHOICE', message, details: [...] }
  if (data.error === 'INVALID_CHOICE' && Array.isArray(data.details)) {
    const details = data.details as Array<{ field: string; message: string }>;
    if (details.length > 0) {
      return details.map((d) => d.message || `${d.field}: invalid value`).join('; ');
    }
  }

  // Flat message string
  if (typeof data.message === 'string') return data.message;

  // Class-validator array
  if (Array.isArray(data.message)) {
    return data.message.filter((m) => typeof m === 'string').join(', ');
  }

  return fallback;
}
