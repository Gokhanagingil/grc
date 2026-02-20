import { TelemetryService, normalizeFrontendError } from './telemetry.service';
import { FrontendErrorDto } from './dto';

describe('normalizeFrontendError', () => {
  describe('full payload (new format)', () => {
    it('should preserve all provided fields', () => {
      const dto: FrontendErrorDto = {
        timestamp: '2026-01-07T20:00:00.000Z',
        pathname: '/test-path',
        userAgent: 'Mozilla/5.0 Test',
        error: {
          name: 'TypeError',
          message: 'Test error message',
          stack: 'Error stack trace',
          componentStack: 'Component stack trace',
        },
        lastApiEndpoint: '/api/test',
        url: 'https://example.com/test',
        userId: 'user-123',
        tenantId: 'tenant-456',
        correlationId: 'corr-789',
        metadata: { key: 'value' },
      };

      const result = normalizeFrontendError(dto);

      expect(result.timestamp).toBe('2026-01-07T20:00:00.000Z');
      expect(result.pathname).toBe('/test-path');
      expect(result.userAgent).toBe('Mozilla/5.0 Test');
      expect(result.errorName).toBe('TypeError');
      expect(result.errorMessage).toBe('Test error message');
      expect(result.errorStack).toBe('Error stack trace');
      expect(result.componentStack).toBe('Component stack trace');
      expect(result.lastApiEndpoint).toBe('/api/test');
      expect(result.url).toBe('https://example.com/test');
      expect(result.userId).toBe('user-123');
      expect(result.tenantId).toBe('tenant-456');
      expect(result.correlationId).toBe('corr-789');
      expect(result.metadata).toEqual({ key: 'value' });
    });
  });

  describe('legacy payload (message/stack at root)', () => {
    it('should normalize legacy format to standard structure', () => {
      const dto: FrontendErrorDto = {
        message: 'legacy error message',
        stack: 'legacy stack trace',
      };

      const result = normalizeFrontendError(dto);

      expect(result.errorMessage).toBe('legacy error message');
      expect(result.errorStack).toBe('legacy stack trace');
      expect(result.errorName).toBe('Error'); // default
      expect(result.pathname).toBe('unknown'); // default
      expect(result.userAgent).toBe('unknown'); // default
      expect(result.timestamp).toBeDefined(); // auto-generated
    });
  });

  describe('minimal new payload (error without name)', () => {
    it('should apply default error name', () => {
      const dto: FrontendErrorDto = {
        error: {
          message: 'minimal error message',
          stack: 'minimal stack trace',
        },
      };

      const result = normalizeFrontendError(dto);

      expect(result.errorName).toBe('Error'); // default
      expect(result.errorMessage).toBe('minimal error message');
      expect(result.errorStack).toBe('minimal stack trace');
    });
  });

  describe('empty payload', () => {
    it('should apply all defaults', () => {
      const dto: FrontendErrorDto = {};

      const result = normalizeFrontendError(dto);

      expect(result.timestamp).toBeDefined();
      expect(result.pathname).toBe('unknown');
      expect(result.userAgent).toBe('unknown');
      expect(result.errorName).toBe('Error');
      expect(result.errorMessage).toBe('unknown');
      expect(result.errorStack).toBeNull();
      expect(result.componentStack).toBeNull();
      expect(result.lastApiEndpoint).toBeNull();
      expect(result.url).toBeNull();
      expect(result.userId).toBeNull();
      expect(result.tenantId).toBeNull();
      expect(result.correlationId).toBeNull();
      expect(result.metadata).toBeNull();
    });
  });

  describe('string truncation', () => {
    it('should truncate extremely long strings', () => {
      const longString = 'x'.repeat(15000);
      const dto: FrontendErrorDto = {
        message: longString,
        stack: longString,
        pathname: longString,
        userAgent: longString,
      };

      const result = normalizeFrontendError(dto);

      // Message truncated to 2000 + truncation suffix
      expect(result.errorMessage.length).toBeLessThan(2100);
      expect(result.errorMessage).toContain('... [truncated]');

      // Stack truncated to 10000 + truncation suffix
      expect(result.errorStack!.length).toBeLessThan(10100);
      expect(result.errorStack).toContain('... [truncated]');

      // Pathname truncated to 500 + truncation suffix
      expect(result.pathname.length).toBeLessThan(600);
      expect(result.pathname).toContain('... [truncated]');

      // UserAgent truncated to 500 + truncation suffix
      expect(result.userAgent.length).toBeLessThan(600);
      expect(result.userAgent).toContain('... [truncated]');
    });

    it('should not truncate strings within limits', () => {
      const dto: FrontendErrorDto = {
        message: 'short message',
        pathname: '/short/path',
        userAgent: 'short agent',
      };

      const result = normalizeFrontendError(dto);

      expect(result.errorMessage).toBe('short message');
      expect(result.pathname).toBe('/short/path');
      expect(result.userAgent).toBe('short agent');
    });
  });

  describe('metadata sanitization', () => {
    it('should remove dangerous prototype pollution keys', () => {
      const dto: FrontendErrorDto = {
        message: 'test',
        metadata: {
          safe: 'value',
          __proto__: { polluted: true },
          constructor: { polluted: true },
          prototype: { polluted: true },
        },
      };

      const result = normalizeFrontendError(dto);

      // Verify only safe keys are present in the result
      expect(result.metadata).toEqual({ safe: 'value' });
      // Verify dangerous keys are not in Object.keys (own properties)
      const metadataKeys = Object.keys(result.metadata!);
      expect(metadataKeys).not.toContain('__proto__');
      expect(metadataKeys).not.toContain('constructor');
      expect(metadataKeys).not.toContain('prototype');
      expect(metadataKeys).toEqual(['safe']);
    });

    it('should recursively sanitize nested objects', () => {
      const dto: FrontendErrorDto = {
        message: 'test',
        metadata: {
          level1: {
            safe: 'nested value',
            __proto__: { polluted: true },
            level2: {
              safe: 'deeply nested',
              constructor: { polluted: true },
            },
          },
        },
      };

      const result = normalizeFrontendError(dto);

      expect(result.metadata).toEqual({
        level1: {
          safe: 'nested value',
          level2: {
            safe: 'deeply nested',
          },
        },
      });
    });

    it('should handle null/undefined metadata', () => {
      const dto1: FrontendErrorDto = { message: 'test', metadata: undefined };
      const dto2: FrontendErrorDto = { message: 'test' };

      expect(normalizeFrontendError(dto1).metadata).toBeNull();
      expect(normalizeFrontendError(dto2).metadata).toBeNull();
    });

    it('should truncate long strings in metadata', () => {
      const longString = 'x'.repeat(15000);
      const dto: FrontendErrorDto = {
        message: 'test',
        metadata: {
          longValue: longString,
        },
      };

      const result = normalizeFrontendError(dto);

      expect(result.metadata!.longValue).toContain('... [truncated]');
      expect((result.metadata!.longValue as string).length).toBeLessThan(10100);
    });

    it('should handle arrays in metadata', () => {
      const dto: FrontendErrorDto = {
        message: 'test',
        metadata: {
          items: ['a', 'b', 'c'],
          numbers: [1, 2, 3],
        },
      };

      const result = normalizeFrontendError(dto);

      expect(result.metadata).toEqual({
        items: ['a', 'b', 'c'],
        numbers: [1, 2, 3],
      });
    });

    it('should limit array size in metadata', () => {
      const largeArray = Array.from({ length: 200 }, (_, i) => `item-${i}`);
      const dto: FrontendErrorDto = {
        message: 'test',
        metadata: {
          items: largeArray,
        },
      };

      const result = normalizeFrontendError(dto);

      expect((result.metadata!.items as string[]).length).toBe(100);
    });
  });

  describe('priority of error fields', () => {
    it('should prefer error.message over root message', () => {
      const dto: FrontendErrorDto = {
        message: 'root message',
        error: {
          message: 'error object message',
        },
      };

      const result = normalizeFrontendError(dto);

      expect(result.errorMessage).toBe('error object message');
    });

    it('should prefer error.stack over root stack', () => {
      const dto: FrontendErrorDto = {
        stack: 'root stack',
        error: {
          stack: 'error object stack',
        },
      };

      const result = normalizeFrontendError(dto);

      expect(result.errorStack).toBe('error object stack');
    });

    it('should fall back to root message if error.message is missing', () => {
      const dto: FrontendErrorDto = {
        message: 'root message',
        error: {
          name: 'CustomError',
        },
      };

      const result = normalizeFrontendError(dto);

      expect(result.errorMessage).toBe('root message');
    });

    it('should fall back to root stack if error.stack is missing', () => {
      const dto: FrontendErrorDto = {
        stack: 'root stack',
        error: {
          name: 'CustomError',
        },
      };

      const result = normalizeFrontendError(dto);

      expect(result.errorStack).toBe('root stack');
    });
  });
});

describe('TelemetryService', () => {
  let service: TelemetryService;

  beforeEach(() => {
    service = new TelemetryService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logFrontendError', () => {
    it('should not throw for any payload type', () => {
      const payloads: FrontendErrorDto[] = [
        {}, // empty
        { message: 'legacy', stack: 'trace' }, // legacy
        { error: { message: 'new', stack: 'trace' } }, // minimal new
        {
          // full
          timestamp: new Date().toISOString(),
          pathname: '/test',
          userAgent: 'test',
          error: { name: 'Error', message: 'test', stack: 'trace' },
        },
        {
          // malicious metadata
          message: 'test',
          metadata: { __proto__: { bad: true } },
        },
        {
          // long strings
          message: 'x'.repeat(15000),
          stack: 'y'.repeat(15000),
        },
      ];

      for (const payload of payloads) {
        expect(() => {
          service.logFrontendError(payload, 'corr-id', 'tenant-id');
        }).not.toThrow();
      }
    });

    it('should handle undefined/null gracefully', () => {
      expect(() => {
        service.logFrontendError({} as FrontendErrorDto, undefined, undefined);
      }).not.toThrow();
    });
  });
});
