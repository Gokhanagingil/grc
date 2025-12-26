/**
 * Log Sanitizer Unit Tests
 *
 * Tests for the log sanitization utility to ensure sensitive data
 * is properly masked before logging.
 *
 * Risk Level: P1 (High) - Critical security component
 */

import {
  sanitizeString,
  sanitizeLogData,
  sanitizeHeaders,
  sanitizeRequestMetadata,
} from './log-sanitizer';

describe('LogSanitizer', () => {
  describe('sanitizeString', () => {
    describe('JWT tokens', () => {
      it('should redact JWT tokens', () => {
        const jwt =
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
        const result = sanitizeString(`Token: ${jwt}`);
        expect(result).toBe('Token: [JWT_REDACTED]');
        expect(result).not.toContain('eyJ');
      });

      it('should redact multiple JWT tokens in a string', () => {
        const jwt1 = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123def456';
        const jwt2 = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIyIn0.xyz789ghi012';
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
        // When Bearer token contains a JWT, the JWT pattern matches first
        const bearerToken =
          'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123def456';
        const result = sanitizeString(bearerToken);
        // JWT pattern matches first, so we get JWT_REDACTED
        expect(result).toBe('Bearer [JWT_REDACTED]');
        expect(result).not.toContain('eyJ');
      });

      it('should redact Basic auth credentials', () => {
        const basicAuth = 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=';
        const result = sanitizeString(basicAuth);
        expect(result).toBe('Basic [CREDENTIALS_REDACTED]');
      });

      it('should handle case-insensitive Bearer with JWT', () => {
        // When Bearer token contains a JWT, the JWT pattern matches first
        const bearerToken =
          'bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123def456';
        const result = sanitizeString(bearerToken);
        // JWT pattern matches first, lowercase bearer preserved
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
          'From: alice@test.com To: bob@example.org',
        );
        expect(result).toBe(
          'From: [EMAIL_REDACTED]@test.com To: [EMAIL_REDACTED]@example.org',
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
          'api_key: "sk_test_FAKE_KEY_FOR_TESTING_ONLY_1234"',
        );
        expect(result).toContain('[KEY_REDACTED]');
        expect(result).not.toContain('sk_test_FAKE');
      });

      it('should redact apikey values', () => {
        const result = sanitizeString(
          'apikey=abcdefghijklmnopqrstuvwxyz123456789012',
        );
        expect(result).toContain('[KEY_REDACTED]');
      });

      it('should redact secret values', () => {
        const result = sanitizeString(
          'secret: "abcdefghijklmnopqrstuvwxyz123456789012"',
        );
        expect(result).toContain('[KEY_REDACTED]');
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

  describe('sanitizeLogData', () => {
    describe('Object sanitization', () => {
      it('should sanitize sensitive keys in objects', () => {
        const data = {
          username: 'john',
          password: 'secret123',
          email: 'john@example.com',
        };
        const result = sanitizeLogData(data);
        expect(result.username).toBe('john');
        expect(result.password).toMatch(/\[REDACTED\]|secr.*\[REDACTED\]/);
        expect(result.email).toBe('[EMAIL_REDACTED]@example.com');
      });

      it('should sanitize authorization key', () => {
        const data = {
          authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc',
        };
        const result = sanitizeLogData(data);
        expect(result.authorization).toMatch(/\[REDACTED\]/);
      });

      it('should sanitize token keys', () => {
        const data = {
          accessToken: 'abc123xyz',
          refresh_token: 'def456uvw',
        };
        const result = sanitizeLogData(data);
        expect(result.accessToken).toMatch(/\[REDACTED\]/);
        expect(result.refresh_token).toMatch(/\[REDACTED\]/);
      });

      it('should sanitize api_key and secret keys', () => {
        const data = {
          api_key: 'sk_live_123456789',
          secret: 'secret_value_here',
        };
        const result = sanitizeLogData(data);
        expect(result.api_key).toMatch(/\[REDACTED\]/);
        expect(result.secret).toMatch(/\[REDACTED\]/);
      });

      it('should sanitize cookie and session keys', () => {
        const data = {
          cookie: 'session=abc123',
          session: 'xyz789',
          sessionId: 'sess_123',
        };
        const result = sanitizeLogData(data);
        expect(result.cookie).toMatch(/\[REDACTED\]/);
        expect(result.session).toMatch(/\[REDACTED\]/);
        expect(result.sessionId).toMatch(/\[REDACTED\]/);
      });
    });

    describe('Nested object sanitization', () => {
      it('should sanitize nested objects with password keys', () => {
        const data = {
          user: {
            name: 'John',
            login: {
              password: 'secret',
            },
          },
        };
        const result = sanitizeLogData(data);
        expect(result.user.name).toBe('John');
        // Password key is sensitive, so it gets redacted
        expect(result.user.login.password).toMatch(/\[REDACTED\]/);
      });

      it('should handle deeply nested structures', () => {
        const data = {
          level1: {
            level2: {
              level3: {
                password: 'deep_secret',
              },
            },
          },
        };
        const result = sanitizeLogData(data);
        expect(result.level1.level2.level3.password).toMatch(/\[REDACTED\]/);
      });

      it('should prevent infinite recursion with max depth', () => {
        const createDeepObject = (depth: number): Record<string, unknown> => {
          if (depth === 0) return { value: 'end' };
          return { nested: createDeepObject(depth - 1) };
        };
        const deepObject = createDeepObject(15);
        const result = sanitizeLogData(deepObject);
        expect(result).toBeDefined();
        // Should hit max depth and return placeholder
        expect(JSON.stringify(result)).toContain('MAX_DEPTH_EXCEEDED');
      });
    });

    describe('Array sanitization', () => {
      it('should sanitize arrays of objects', () => {
        const data = [{ email: 'user1@test.com' }, { email: 'user2@test.com' }];
        const result = sanitizeLogData(data);
        expect(result[0].email).toBe('[EMAIL_REDACTED]@test.com');
        expect(result[1].email).toBe('[EMAIL_REDACTED]@test.com');
      });

      it('should sanitize arrays of strings', () => {
        const data = ['Bearer token123.abc.xyz', 'normal string'];
        const result = sanitizeLogData(data);
        expect(result[0]).not.toContain('token123');
        expect(result[1]).toBe('normal string');
      });
    });

    describe('Error object sanitization', () => {
      it('should sanitize Error objects', () => {
        const error = new Error('Failed for user@example.com');
        const result = sanitizeLogData(error);
        expect(result.message).toBe('Failed for [EMAIL_REDACTED]@example.com');
        expect(result.name).toBe('Error');
      });

      it('should sanitize Error stack traces', () => {
        const error = new Error('Password: secret123 is invalid');
        const result = sanitizeLogData(error);
        expect(result.message).not.toContain('secret123');
      });
    });

    describe('Edge cases', () => {
      it('should handle null values', () => {
        expect(sanitizeLogData(null)).toBeNull();
      });

      it('should handle undefined values', () => {
        expect(sanitizeLogData(undefined)).toBeUndefined();
      });

      it('should handle primitive values', () => {
        expect(sanitizeLogData(123)).toBe(123);
        expect(sanitizeLogData(true)).toBe(true);
      });

      it('should handle objects with null/undefined values', () => {
        const data = {
          name: 'John',
          password: null,
          token: undefined,
        };
        const result = sanitizeLogData(data);
        expect(result.name).toBe('John');
        expect(result.password).toBeNull();
        expect(result.token).toBeUndefined();
      });
    });
  });

  describe('sanitizeHeaders', () => {
    it('should redact authorization header', () => {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'Bearer abc123',
      };
      const result = sanitizeHeaders(headers);
      expect(result['Content-Type']).toBe('application/json');
      expect(result['Authorization']).toBe('[REDACTED]');
    });

    it('should redact cookie header', () => {
      const headers = {
        Cookie: 'session=abc123; token=xyz789',
      };
      const result = sanitizeHeaders(headers);
      expect(result['Cookie']).toBe('[REDACTED]');
    });

    it('should redact x-api-key header', () => {
      const headers = {
        'X-API-Key': 'sk_live_123456789',
      };
      const result = sanitizeHeaders(headers);
      expect(result['X-API-Key']).toBe('[REDACTED]');
    });

    it('should handle case-insensitive header names', () => {
      const headers = {
        authorization: 'Bearer token',
        COOKIE: 'session=123',
      };
      const result = sanitizeHeaders(headers);
      expect(result['authorization']).toBe('[REDACTED]');
      expect(result['COOKIE']).toBe('[REDACTED]');
    });

    it('should sanitize string values in other headers', () => {
      const headers = {
        'X-Custom': 'user@example.com',
      };
      const result = sanitizeHeaders(headers);
      expect(result['X-Custom']).toBe('[EMAIL_REDACTED]@example.com');
    });

    it('should handle array header values', () => {
      const headers = {
        'X-Forwarded-For': ['192.168.1.1', 'user@test.com'],
      };
      const result = sanitizeHeaders(headers);
      expect(result['X-Forwarded-For']).toEqual([
        '192.168.1.1',
        '[EMAIL_REDACTED]@test.com',
      ]);
    });

    it('should handle undefined header values', () => {
      const headers = {
        'Content-Type': 'application/json',
        'X-Optional': undefined,
      };
      const result = sanitizeHeaders(headers);
      expect(result['Content-Type']).toBe('application/json');
      expect(result['X-Optional']).toBeUndefined();
    });
  });

  describe('sanitizeRequestMetadata', () => {
    it('should sanitize all metadata fields', () => {
      const metadata = {
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
        body: {
          username: 'john',
          password: 'secret',
        },
        query: {
          email: 'user@test.com',
        },
        params: {
          id: '123',
        },
      };

      const result = sanitizeRequestMetadata(metadata);

      expect(result.headers?.['Authorization']).toBe('[REDACTED]');
      expect(result.headers?.['Content-Type']).toBe('application/json');
      expect((result.body as Record<string, unknown>)?.username).toBe('john');
      expect((result.body as Record<string, unknown>)?.password).toMatch(
        /\[REDACTED\]/,
      );
      expect((result.query as Record<string, unknown>)?.email).toBe(
        '[EMAIL_REDACTED]@test.com',
      );
      expect((result.params as Record<string, unknown>)?.id).toBe('123');
    });

    it('should handle missing metadata fields', () => {
      const metadata = {
        headers: { 'Content-Type': 'application/json' },
      };

      const result = sanitizeRequestMetadata(metadata);

      expect(result.headers).toBeDefined();
      expect(result.body).toBeUndefined();
      expect(result.query).toBeUndefined();
      expect(result.params).toBeUndefined();
    });

    it('should handle empty metadata', () => {
      const result = sanitizeRequestMetadata({});
      expect(result.headers).toBeUndefined();
      expect(result.body).toBeUndefined();
      expect(result.query).toBeUndefined();
      expect(result.params).toBeUndefined();
    });
  });
});
