/**
 * Error Sanitizer Unit Tests
 *
 * Tests for the error sanitization utility to ensure sensitive data
 * is properly masked before sending telemetry.
 *
 * Risk Level: P1 (High) - Critical security component
 */

import {
  sanitizeString,
  sanitizeErrorMessage,
  sanitizeStackTrace,
  sanitizeComponentStack,
  createSanitizedErrorPayload,
} from '../errorSanitizer';

describe('ErrorSanitizer', () => {
  describe('sanitizeString', () => {
    describe('JWT tokens', () => {
      it('should redact JWT tokens', () => {
        const jwt =
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.FAKE_SIG_FOR_TESTING_abc123';
        const result = sanitizeString(`Token: ${jwt}`);
        expect(result).toBe('Token: [JWT_REDACTED]');
        expect(result).not.toContain('eyJ');
      });

      it('should redact multiple JWT tokens in a string', () => {
        const jwt1 =
          'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.FAKE_SIG_FOR_TESTING_001';
        const jwt2 =
          'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIyIn0.FAKE_SIG_FOR_TESTING_002';
        const result = sanitizeString(`First: ${jwt1}, Second: ${jwt2}`);
        expect(result).toBe('First: [JWT_REDACTED], Second: [JWT_REDACTED]');
      });

      it('should not redact non-JWT strings starting with eyJ', () => {
        const result = sanitizeString('eyJust a normal string');
        expect(result).toBe('eyJust a normal string');
      });
    });

    describe('Authorization headers', () => {
      it('should redact Bearer tokens with JWT', () => {
        const bearerToken =
          'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.FAKE_SIG_FOR_TESTING_003';
        const result = sanitizeString(bearerToken);
        expect(result).toBe('Bearer [JWT_REDACTED]');
        expect(result).not.toContain('eyJ');
      });

      it('should redact Basic auth credentials', () => {
        const basicAuth = 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=';
        const result = sanitizeString(basicAuth);
        expect(result).toBe('Basic [CREDENTIALS_REDACTED]');
      });

      it('should handle case-insensitive Bearer with JWT', () => {
        const bearerToken =
          'bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.FAKE_SIG_FOR_TESTING_004';
        const result = sanitizeString(bearerToken);
        expect(result).toBe('bearer [JWT_REDACTED]');
        expect(result).not.toContain('eyJ');
      });
    });

    describe('Email addresses', () => {
      it('should redact email addresses but preserve domain', () => {
        const result = sanitizeString('User email: john.doe@example.com');
        expect(result).toBe('User email: [EMAIL_REDACTED]@example.com');
        expect(result).not.toContain('john.doe');
      });

      it('should redact multiple email addresses', () => {
        const result = sanitizeString(
          'From: alice@test.com To: bob@example.org'
        );
        expect(result).toBe(
          'From: [EMAIL_REDACTED]@test.com To: [EMAIL_REDACTED]@example.org'
        );
      });

      it('should handle emails with plus signs', () => {
        const result = sanitizeString('Email: user+tag@domain.com');
        expect(result).toBe('Email: [EMAIL_REDACTED]@domain.com');
      });
    });

    describe('Password values', () => {
      it('should redact password in JSON format', () => {
        const result = sanitizeString('{"password": "secretPassword123"}');
        expect(result).toBe('{"password": "[PASSWORD_REDACTED]"}');
        expect(result).not.toContain('secretPassword123');
      });

      it('should redact password in query string format', () => {
        const result = sanitizeString('password=mySecret123&user=john');
        expect(result).toBe('password=[PASSWORD_REDACTED]&user=john');
      });

      it('should redact pwd variations', () => {
        const result = sanitizeString('pwd: "myPassword"');
        expect(result).toBe('pwd: "[PASSWORD_REDACTED]"');
      });

      it('should redact passwd variations', () => {
        const result = sanitizeString('passwd=secret123');
        expect(result).toBe('passwd=[PASSWORD_REDACTED]');
      });
    });

    describe('API keys', () => {
      it('should redact api_key values', () => {
        const result = sanitizeString(
          'api_key: "sk_test_FAKE_KEY_FOR_TESTING_ONLY_1234"'
        );
        expect(result).toContain('[KEY_REDACTED]');
        expect(result).not.toContain('sk_test_FAKE');
      });

      it('should redact apikey values', () => {
        const result = sanitizeString(
          'apikey=abcdefghijklmnopqrstuvwxyz123456789012'
        );
        expect(result).toContain('[KEY_REDACTED]');
      });

      it('should redact secret values', () => {
        const result = sanitizeString(
          'secret: "abcdefghijklmnopqrstuvwxyz123456789012"'
        );
        expect(result).toContain('[KEY_REDACTED]');
      });
    });

    describe('Cookie values', () => {
      it('should redact cookie values', () => {
        const result = sanitizeString('cookie: "session_abc123xyz"');
        expect(result).toContain('[COOKIE_REDACTED]');
      });

      it('should redact session values', () => {
        const result = sanitizeString('session=mysessionid123');
        expect(result).toContain('[COOKIE_REDACTED]');
      });
    });

    describe('Edge cases', () => {
      it('should return null/undefined as-is', () => {
        expect(sanitizeString(null as unknown as string)).toBeNull();
        expect(sanitizeString(undefined as unknown as string)).toBeUndefined();
      });

      it('should return non-string values as-is', () => {
        expect(sanitizeString(123 as unknown as string)).toBe(123);
        expect(sanitizeString({} as unknown as string)).toEqual({});
      });

      it('should handle empty strings', () => {
        expect(sanitizeString('')).toBe('');
      });

      it('should handle strings without sensitive data', () => {
        const safe = 'This is a normal log message';
        expect(sanitizeString(safe)).toBe(safe);
      });
    });
  });

  describe('sanitizeErrorMessage', () => {
    it('should sanitize and return the message', () => {
      const message = 'Error for user@example.com';
      const result = sanitizeErrorMessage(message);
      expect(result).toBe('Error for [EMAIL_REDACTED]@example.com');
    });

    it('should truncate long messages', () => {
      const longMessage = 'A'.repeat(600);
      const result = sanitizeErrorMessage(longMessage);
      expect(result.length).toBeLessThanOrEqual(514); // 500 + '...[TRUNCATED]'
      expect(result).toContain('...[TRUNCATED]');
    });

    it('should handle null/undefined', () => {
      expect(sanitizeErrorMessage(null)).toBe('');
      expect(sanitizeErrorMessage(undefined)).toBe('');
    });

    it('should respect custom max length', () => {
      const message = 'A'.repeat(200);
      const result = sanitizeErrorMessage(message, 100);
      expect(result.length).toBeLessThanOrEqual(114); // 100 + '...[TRUNCATED]'
    });
  });

  describe('sanitizeStackTrace', () => {
    it('should sanitize stack traces', () => {
      const stack = `Error: Failed for user@test.com
    at Component (app.js:123)
    at render (react.js:456)`;
      const result = sanitizeStackTrace(stack);
      expect(result).toContain('[EMAIL_REDACTED]@test.com');
      expect(result).not.toContain('user@test.com');
    });

    it('should truncate long stack traces', () => {
      const longStack = 'at function (file.js:1)\n'.repeat(200);
      const result = sanitizeStackTrace(longStack);
      expect(result.length).toBeLessThanOrEqual(2014); // 2000 + '...[TRUNCATED]'
      expect(result).toContain('...[TRUNCATED]');
    });

    it('should handle null/undefined', () => {
      expect(sanitizeStackTrace(null)).toBe('');
      expect(sanitizeStackTrace(undefined)).toBe('');
    });
  });

  describe('sanitizeComponentStack', () => {
    it('should sanitize component stacks', () => {
      const componentStack = `
    at Dashboard
    at Layout
    at AuthProvider`;
      const result = sanitizeComponentStack(componentStack);
      expect(result).toContain('Dashboard');
      expect(result).toContain('Layout');
    });

    it('should truncate long component stacks', () => {
      const longStack = '    at Component\n'.repeat(100);
      const result = sanitizeComponentStack(longStack);
      expect(result.length).toBeLessThanOrEqual(1014); // 1000 + '...[TRUNCATED]'
    });

    it('should handle null/undefined', () => {
      expect(sanitizeComponentStack(null)).toBe('');
      expect(sanitizeComponentStack(undefined)).toBe('');
    });
  });

  describe('createSanitizedErrorPayload', () => {
    it('should create a sanitized payload from an error', () => {
      const error = new Error('Failed for user@example.com');
      error.name = 'ValidationError';

      const result = createSanitizedErrorPayload(error);

      expect(result.name).toBe('ValidationError');
      expect(result.message).toBe('Failed for [EMAIL_REDACTED]@example.com');
      expect(result.stack).toBeDefined();
      expect(result.componentStack).toBe('');
    });

    it('should include sanitized component stack when provided', () => {
      const error = new Error('Test error');
      const errorInfo = {
        componentStack: '\n    at Dashboard\n    at Layout',
      };

      const result = createSanitizedErrorPayload(error, errorInfo);

      expect(result.componentStack).toContain('Dashboard');
      expect(result.componentStack).toContain('Layout');
    });

    it('should handle errors without name', () => {
      const error = new Error('Test');
      delete (error as { name?: string }).name;

      const result = createSanitizedErrorPayload(error);

      expect(result.name).toBe('Error');
    });

    it('should sanitize JWT tokens in error messages', () => {
      const jwt =
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.FAKE_SIG_FOR_TESTING';
      const error = new Error(`Invalid token: ${jwt}`);

      const result = createSanitizedErrorPayload(error);

      expect(result.message).toBe('Invalid token: [JWT_REDACTED]');
      expect(result.message).not.toContain('eyJ');
    });
  });
});
