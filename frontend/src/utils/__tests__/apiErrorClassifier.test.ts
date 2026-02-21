/**
 * API Error Classifier Unit Tests
 *
 * Tests for classifyApiError utility to ensure correct error classification
 * and auth policy enforcement:
 * - 401 → auth kind, shouldLogout = true
 * - 403 → forbidden kind, shouldLogout = false (CRITICAL: prevents false logout)
 * - 400/422 → validation
 * - 404 → not_found
 * - 500+ → server, retryable
 * - Network errors → network, retryable
 *
 * @regression
 */

import { classifyApiError, ClassifiedApiError } from '../apiErrorClassifier';

/* ------------------------------------------------------------------ */
/* Helpers to create mock AxiosError-like objects                      */
/* ------------------------------------------------------------------ */

function makeAxiosError(
  status: number,
  data?: Record<string, unknown>,
  message = 'Request failed',
): { isAxiosError: true; response: { status: number; data: unknown }; message: string; config: object } {
  return {
    isAxiosError: true,
    response: { status, data: data || {} },
    message,
    config: {},
  };
}

function makeNetworkError(code?: string): {
  isAxiosError: true;
  response: undefined;
  message: string;
  code?: string;
  config: object;
} {
  return {
    isAxiosError: true,
    response: undefined,
    message: 'Network Error',
    code,
    config: {},
  };
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe('classifyApiError', () => {
  describe('401 Unauthorized (auth)', () => {
    it('should classify as auth with shouldLogout = true', () => {
      const err = makeAxiosError(401);
      const result: ClassifiedApiError = classifyApiError(err);

      expect(result.kind).toBe('auth');
      expect(result.status).toBe(401);
      expect(result.shouldLogout).toBe(true);
      expect(result.isRetryable).toBe(false);
    });

    it('should use server message when available', () => {
      const err = makeAxiosError(401, { message: 'Token expired' });
      const result = classifyApiError(err);

      expect(result.kind).toBe('auth');
      expect(result.message).toBe('Token expired');
    });

    it('should provide fallback message when server message missing', () => {
      const err = makeAxiosError(401, {});
      const result = classifyApiError(err);

      // When data is empty {}, extractErrorMessage falls back to axios message
      // The classifyApiError only uses 'Session expired' fallback when message is empty
      expect(result.kind).toBe('auth');
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    });
  });

  describe('403 Forbidden — MUST NOT trigger logout', () => {
    it('should classify as forbidden with shouldLogout = false', () => {
      const err = makeAxiosError(403);
      const result = classifyApiError(err);

      expect(result.kind).toBe('forbidden');
      expect(result.status).toBe(403);
      expect(result.shouldLogout).toBe(false);
      expect(result.isRetryable).toBe(false);
    });

    it('should extract message from NestJS error envelope', () => {
      const err = makeAxiosError(403, {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions for ITSM changes' },
      });
      const result = classifyApiError(err);

      expect(result.kind).toBe('forbidden');
      expect(result.shouldLogout).toBe(false);
      expect(result.message).toBe('Insufficient permissions for ITSM changes');
    });

    it('should never have shouldLogout=true even with misleading message', () => {
      const err = makeAxiosError(403, { message: 'session expired' });
      const result = classifyApiError(err);

      expect(result.kind).toBe('forbidden');
      expect(result.shouldLogout).toBe(false);
    });
  });

  describe('400/422 Validation errors', () => {
    it('should classify 400 as validation', () => {
      const err = makeAxiosError(400, { message: 'approvalStatus is managed by the system' });
      const result = classifyApiError(err);

      expect(result.kind).toBe('validation');
      expect(result.status).toBe(400);
      expect(result.shouldLogout).toBe(false);
      expect(result.message).toBe('approvalStatus is managed by the system');
    });

    it('should classify 422 as validation', () => {
      const err = makeAxiosError(422);
      const result = classifyApiError(err);

      expect(result.kind).toBe('validation');
      expect(result.status).toBe(422);
    });

    it('should extract message from NestJS envelope with field errors', () => {
      const err = makeAxiosError(400, {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          fieldErrors: [
            { field: 'title', message: 'Title is required' },
            { field: 'type', message: 'Invalid type' },
          ],
        },
      });
      const result = classifyApiError(err);

      expect(result.kind).toBe('validation');
      // extractErrorMessage returns error.message first if it exists
      // The NestJS error envelope has { error: { message, fieldErrors } }
      // and extractErrorMessage checks error.message before fieldErrors
      expect(result.message).toBe('Validation failed');
    });

    it('should extract field errors when no message in error envelope', () => {
      const err = makeAxiosError(400, {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          fieldErrors: [
            { field: 'title', message: 'Title is required' },
          ],
        },
      });
      const result = classifyApiError(err);

      expect(result.kind).toBe('validation');
      expect(result.message).toContain('title');
      expect(result.message).toContain('Title is required');
    });

    it('should extract class-validator array messages', () => {
      const err = makeAxiosError(400, {
        message: ['title must not be empty', 'type must be a valid enum'],
      });
      const result = classifyApiError(err);

      expect(result.kind).toBe('validation');
      expect(result.message).toContain('title must not be empty');
    });
  });

  describe('404 Not Found', () => {
    it('should classify as not_found', () => {
      const err = makeAxiosError(404, { message: 'Change not found' });
      const result = classifyApiError(err);

      expect(result.kind).toBe('not_found');
      expect(result.status).toBe(404);
      expect(result.shouldLogout).toBe(false);
      expect(result.message).toBe('Change not found');
    });
  });

  describe('409 Conflict', () => {
    it('should classify as conflict and be retryable', () => {
      const err = makeAxiosError(409);
      const result = classifyApiError(err);

      expect(result.kind).toBe('conflict');
      expect(result.isRetryable).toBe(true);
      expect(result.shouldLogout).toBe(false);
    });
  });

  describe('429 Rate Limit', () => {
    it('should classify as rate_limit and be retryable', () => {
      const err = makeAxiosError(429);
      const result = classifyApiError(err);

      expect(result.kind).toBe('rate_limit');
      expect(result.isRetryable).toBe(true);
      expect(result.shouldLogout).toBe(false);
    });
  });

  describe('500+ Server errors', () => {
    it('should classify 500 as server error', () => {
      const err = makeAxiosError(500);
      const result = classifyApiError(err);

      expect(result.kind).toBe('server');
      expect(result.status).toBe(500);
      expect(result.isRetryable).toBe(true);
      expect(result.shouldLogout).toBe(false);
    });

    it('should classify 502 as server error', () => {
      const err = makeAxiosError(502);
      const result = classifyApiError(err);

      expect(result.kind).toBe('server');
    });

    it('should classify 503 as server error', () => {
      const err = makeAxiosError(503);
      const result = classifyApiError(err);

      expect(result.kind).toBe('server');
      expect(result.isRetryable).toBe(true);
    });
  });

  describe('Network errors (no response)', () => {
    it('should classify as network error', () => {
      const err = makeNetworkError();
      const result = classifyApiError(err);

      expect(result.kind).toBe('network');
      expect(result.status).toBeNull();
      expect(result.isRetryable).toBe(true);
      expect(result.shouldLogout).toBe(false);
    });

    it('should detect timeout via ECONNABORTED code', () => {
      const err = makeNetworkError('ECONNABORTED');
      const result = classifyApiError(err);

      expect(result.kind).toBe('network');
      expect(result.message).toContain('timed out');
    });
  });

  describe('Non-Axios errors', () => {
    it('should handle generic Error objects', () => {
      const err = new Error('Something broke');
      const result = classifyApiError(err);

      expect(result.kind).toBe('unknown');
      expect(result.status).toBeNull();
      expect(result.message).toBe('Something broke');
      expect(result.shouldLogout).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(classifyApiError(null).kind).toBe('unknown');
      expect(classifyApiError(undefined).kind).toBe('unknown');
    });

    it('should handle string errors', () => {
      const result = classifyApiError('some error string');
      expect(result.kind).toBe('unknown');
      expect(result.shouldLogout).toBe(false);
    });
  });

  describe('Auth policy enforcement (cross-cutting)', () => {
    it('only 401 should have shouldLogout=true', () => {
      const statuses = [400, 403, 404, 409, 422, 429, 500, 502, 503];
      for (const status of statuses) {
        const err = makeAxiosError(status);
        const result = classifyApiError(err);
        expect(result.shouldLogout).toBe(false);
      }
    });

    it('401 must always have shouldLogout=true', () => {
      const err = makeAxiosError(401);
      expect(classifyApiError(err).shouldLogout).toBe(true);
    });

    it('original error should be preserved', () => {
      const err = makeAxiosError(403);
      const result = classifyApiError(err);
      expect(result.original).toBe(err);
    });
  });
});
