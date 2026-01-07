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
        // Using FAKE_SIG_FOR_TESTING marker to identify test fixtures
        const jwt =
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.FAKE_SIG_FOR_TESTING_abc123';
        const result = sanitizeString(`Token: ${jwt}`);
        expect(result).toBe('Token: [JWT_REDACTED]');
        expect(result).not.toContain('eyJ');
      });

      it('should redact multiple JWT tokens in a string', () => {
        // Using FAKE_SIG_FOR_TESTING marker to identify test fixtures
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
        // When Bearer token contains a JWT, the JWT pattern matches first
        // Using FAKE_SIG_FOR_TESTING marker to identify test fixtures
        const bearerToken =
          'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.FAKE_SIG_FOR_TESTING_003';
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
        // Using FAKE_SIG_FOR_TESTING marker to identify test fixtures
        const bearerToken =
          'bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.FAKE_SIG_FOR_TESTING_004';
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
        // Using FAKE_SIG_FOR_TESTING marker to identify test fixtures
        const data = {
          authorization:
            'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.FAKE_SIG_FOR_TESTING_005',
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

  describe('Security: ReDoS Prevention', () => {
    it('should sanitize very long strings starting with eyJ quickly (no regex backtracking)', () => {
      // This test verifies that the O(n) JWT scanning function handles
      // pathological inputs without exponential backtracking
      const maliciousInput = 'eyJ' + 'a'.repeat(10000);
      const startTime = Date.now();
      const result = sanitizeString(maliciousInput);
      const endTime = Date.now();

      // Should complete in under 500ms (O(n) complexity) - allowing for CI variability
      expect(endTime - startTime).toBeLessThan(500);
      // Should not be redacted since it's not a valid JWT (no dots)
      expect(result).toContain('eyJ');
    });

    it('should handle repeated eyJ patterns quickly', () => {
      // Multiple potential JWT starts that could cause backtracking
      const maliciousInput = 'eyJ'.repeat(1000) + '.payload.signature';
      const startTime = Date.now();
      const result = sanitizeString(maliciousInput);
      const endTime = Date.now();

      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(100);
      expect(result).toBeDefined();
    });

    it('should handle strings with many percent signs quickly', () => {
      // Percent-encoded patterns that could cause backtracking in naive regex
      const maliciousInput = '%'.repeat(5000) + 'normal text';
      const startTime = Date.now();
      const result = sanitizeString(maliciousInput);
      const endTime = Date.now();

      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(100);
      expect(result).toBeDefined();
    });

    it('should truncate very long inputs to prevent DoS', () => {
      const veryLongInput = 'a'.repeat(20000);
      const result = sanitizeString(veryLongInput);

      // Should be truncated to MAX_INPUT_LENGTH (10000) + [TRUNCATED] marker
      expect(result.length).toBeLessThan(veryLongInput.length);
      expect(result).toContain('[TRUNCATED]');
    });

    it('should handle JWT-like patterns with many dots quickly', () => {
      // Pattern that could cause backtracking: many dots with base64-like chars
      const maliciousInput = 'eyJhbGciOiJIUzI1NiJ9' + '.abc'.repeat(1000);
      const startTime = Date.now();
      const result = sanitizeString(maliciousInput);
      const endTime = Date.now();

      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(100);
      expect(result).toBeDefined();
    });
  });

  describe('Security: Prototype Pollution Prevention', () => {
    it('should not write __proto__ key to sanitized objects', () => {
      // Create object with __proto__ as own property using Object.defineProperty
      const maliciousData: Record<string, unknown> = { name: 'test' };
      Object.defineProperty(maliciousData, '__proto__', {
        value: { polluted: true },
        enumerable: true,
        configurable: true,
        writable: true,
      });

      const result = sanitizeLogData(maliciousData);

      // The __proto__ key should be skipped and marker should be set
      expect(result['[UNSAFE_KEY_SKIPPED]']).toBe(true);
      // The __proto__ key should not be in the result
      expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(
        false,
      );
      // Verify prototype is not polluted
      const emptyObj: Record<string, unknown> = {};
      expect(emptyObj['polluted']).toBeUndefined();
    });

    it('should not write constructor key to sanitized objects', () => {
      const maliciousData = {
        name: 'test',
        constructor: { polluted: true },
      };

      const result = sanitizeLogData(maliciousData);

      // The constructor key should be skipped
      expect(result['[UNSAFE_KEY_SKIPPED]']).toBe(true);
      expect(result['constructor']).toBeUndefined();
    });

    it('should not write prototype key to sanitized objects', () => {
      const maliciousData = {
        name: 'test',
        prototype: { polluted: true },
      };

      const result = sanitizeLogData(maliciousData);

      // The prototype key should be skipped
      expect(result['[UNSAFE_KEY_SKIPPED]']).toBe(true);
      expect(result['prototype']).toBeUndefined();
    });

    it('should handle nested objects with dangerous keys', () => {
      // Create nested object with __proto__ as own property
      const nestedObj: Record<string, unknown> = { name: 'John' };
      Object.defineProperty(nestedObj, '__proto__', {
        value: { admin: true },
        enumerable: true,
        configurable: true,
        writable: true,
      });
      const maliciousData = { user: nestedObj };

      const result = sanitizeLogData(maliciousData);

      // Should sanitize nested object and skip dangerous key
      expect(result.user.name).toBe('John');
      expect(result.user['[UNSAFE_KEY_SKIPPED]']).toBe(true);
    });

    it('should reject keys with invalid characters', () => {
      const maliciousData = {
        normal_key: 'value1',
        'key with spaces': 'value2',
        'key<script>': 'value3',
      };

      const result = sanitizeLogData(maliciousData);

      // Valid key should be preserved
      expect(result['normal_key']).toBe('value1');
      // Invalid keys should be skipped
      expect(result['[UNSAFE_KEY_SKIPPED]']).toBe(true);
      expect(result['key with spaces']).toBeUndefined();
      expect(result['key<script>']).toBeUndefined();
    });

    it('should reject keys longer than 80 characters', () => {
      const longKey = 'a'.repeat(100);
      const maliciousData = {
        [longKey]: 'value',
        normalKey: 'normalValue',
      };

      const result = sanitizeLogData(maliciousData);

      // Long key should be skipped
      expect(result['[UNSAFE_KEY_SKIPPED]']).toBe(true);
      expect(result[longKey]).toBeUndefined();
      // Normal key should be preserved
      expect(result['normalKey']).toBe('normalValue');
    });

    it('should use Object.create(null) to prevent prototype chain access', () => {
      const data = { name: 'test' };
      const result = sanitizeLogData(data);

      // Result should not have Object.prototype methods accessible via hasOwnProperty check
      // This verifies Object.create(null) was used
      expect(Object.getPrototypeOf(result)).toBeNull();
    });

    it('should handle sanitizeHeaders with dangerous keys', () => {
      const maliciousHeaders = {
        'Content-Type': 'application/json',
        __proto__: 'malicious',
        constructor: 'malicious',
      };

      const result = sanitizeHeaders(maliciousHeaders);

      // Valid header should be preserved
      expect(result['Content-Type']).toBe('application/json');
      // Dangerous keys should be skipped
      expect(result['__proto__']).toBeUndefined();
      expect(result['constructor']).toBeUndefined();
    });
  });

  describe('Security: Resource Limits', () => {
    it('should limit array processing to prevent memory bombs', () => {
      // Create a large array
      const largeArray = Array(2000).fill({ name: 'test' });
      const result = sanitizeLogData(largeArray);

      // Should be truncated and include marker
      expect(result.length).toBeLessThanOrEqual(1001); // MAX_OBJECT_KEYS + 1 for marker
      expect(result[result.length - 1]).toBe('[ARRAY_TRUNCATED]');
    });

    it('should limit object keys to prevent memory bombs', () => {
      // Create an object with many keys
      const largeObject: Record<string, string> = {};
      for (let i = 0; i < 2000; i++) {
        largeObject[`key${i}`] = 'value';
      }

      const result = sanitizeLogData(largeObject);

      // Should have truncation marker
      expect(result['[KEYS_TRUNCATED]']).toBe(true);
    });
  });
});
