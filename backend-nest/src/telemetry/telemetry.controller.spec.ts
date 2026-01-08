import { Test, TestingModule } from '@nestjs/testing';
import {
  TelemetryController,
  ApiTelemetryController,
} from './telemetry.controller';
import { TelemetryService } from './telemetry.service';
import { FrontendErrorDto } from './dto';

/**
 * Create a full payload with all fields populated (new format)
 */
const createFullPayload = (): FrontendErrorDto => ({
  timestamp: new Date().toISOString(),
  pathname: '/audits/123',
  error: {
    name: 'TypeError',
    message: 'Test error',
    stack: 'Error stack trace',
  },
  userAgent: 'Mozilla/5.0 Test',
});

/**
 * Create a legacy payload (old format with message/stack at root)
 */
const createLegacyPayload = (): FrontendErrorDto => ({
  message: 'legacy test error',
  stack: 'legacy stack trace',
});

/**
 * Create a minimal new format payload (error object without name)
 */
const createMinimalNewPayload = (): FrontendErrorDto => ({
  error: {
    message: 'minimal test error',
    stack: 'minimal stack trace',
  },
});

/**
 * Create an empty payload (all defaults will be applied)
 */
const createEmptyPayload = (): FrontendErrorDto => ({});

/**
 * Create a payload with malicious metadata (prototype pollution attempt)
 */
const createMaliciousMetadataPayload = (): FrontendErrorDto => ({
  message: 'test with malicious metadata',
  metadata: {
    safe: 'value',
    __proto__: { polluted: true },
    constructor: { polluted: true },
    prototype: { polluted: true },
    nested: {
      __proto__: { polluted: true },
      safe: 'nested value',
    },
  },
});

/**
 * Create a payload with extremely long strings
 */
const createLongStringPayload = (): FrontendErrorDto => ({
  message: 'x'.repeat(15000), // Exceeds 10k limit
  stack: 'y'.repeat(15000),
  pathname: 'z'.repeat(1000), // Exceeds 500 limit
  userAgent: 'a'.repeat(1000),
});

/**
 * Standard expected response for all telemetry requests
 */
const EXPECTED_RESPONSE = {
  success: true,
  message: 'Error reported successfully',
};

describe('TelemetryController', () => {
  let controller: TelemetryController;
  let service: TelemetryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelemetryController],
      providers: [
        {
          provide: TelemetryService,
          useValue: {
            logFrontendError: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TelemetryController>(TelemetryController);
    service = module.get<TelemetryService>(TelemetryService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('reportFrontendError', () => {
    it('should return success for full payload', () => {
      const errorPayload = createFullPayload();
      const correlationId = 'test-correlation-id';
      const tenantId = 'test-tenant-id';

      const result = controller.reportFrontendError(
        errorPayload,
        correlationId,
        tenantId,
      );

      expect(service.logFrontendError).toHaveBeenCalledWith(
        errorPayload,
        correlationId,
        tenantId,
      );
      expect(result).toEqual(EXPECTED_RESPONSE);
    });

    it('should return success for legacy payload (message/stack at root)', () => {
      const errorPayload = createLegacyPayload();

      const result = controller.reportFrontendError(errorPayload);

      expect(service.logFrontendError).toHaveBeenCalledWith(
        errorPayload,
        undefined,
        undefined,
      );
      expect(result).toEqual(EXPECTED_RESPONSE);
    });

    it('should return success for minimal new payload (error without name)', () => {
      const errorPayload = createMinimalNewPayload();

      const result = controller.reportFrontendError(errorPayload);

      expect(service.logFrontendError).toHaveBeenCalledWith(
        errorPayload,
        undefined,
        undefined,
      );
      expect(result).toEqual(EXPECTED_RESPONSE);
    });

    it('should return success for empty payload', () => {
      const errorPayload = createEmptyPayload();

      const result = controller.reportFrontendError(errorPayload);

      expect(service.logFrontendError).toHaveBeenCalledWith(
        errorPayload,
        undefined,
        undefined,
      );
      expect(result).toEqual(EXPECTED_RESPONSE);
    });

    it('should return success for payload with malicious metadata', () => {
      const errorPayload = createMaliciousMetadataPayload();

      const result = controller.reportFrontendError(errorPayload);

      expect(service.logFrontendError).toHaveBeenCalledWith(
        errorPayload,
        undefined,
        undefined,
      );
      expect(result).toEqual(EXPECTED_RESPONSE);
    });

    it('should return success for payload with extremely long strings', () => {
      const errorPayload = createLongStringPayload();

      const result = controller.reportFrontendError(errorPayload);

      expect(service.logFrontendError).toHaveBeenCalledWith(
        errorPayload,
        undefined,
        undefined,
      );
      expect(result).toEqual(EXPECTED_RESPONSE);
    });

    it('should work without optional headers', () => {
      const errorPayload = createFullPayload();

      const result = controller.reportFrontendError(errorPayload);

      expect(service.logFrontendError).toHaveBeenCalledWith(
        errorPayload,
        undefined,
        undefined,
      );
      expect(result).toEqual(EXPECTED_RESPONSE);
    });
  });
});

describe('ApiTelemetryController', () => {
  let controller: ApiTelemetryController;
  let service: TelemetryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiTelemetryController],
      providers: [
        {
          provide: TelemetryService,
          useValue: {
            logFrontendError: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ApiTelemetryController>(ApiTelemetryController);
    service = module.get<TelemetryService>(TelemetryService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('reportFrontendError', () => {
    it('should return success for full payload', () => {
      const errorPayload = createFullPayload();
      const correlationId = 'test-correlation-id';
      const tenantId = 'test-tenant-id';

      const result = controller.reportFrontendError(
        errorPayload,
        correlationId,
        tenantId,
      );

      expect(service.logFrontendError).toHaveBeenCalledWith(
        errorPayload,
        correlationId,
        tenantId,
      );
      expect(result).toEqual(EXPECTED_RESPONSE);
    });

    it('should return success for legacy payload', () => {
      const errorPayload = createLegacyPayload();

      const result = controller.reportFrontendError(errorPayload);

      expect(result).toEqual(EXPECTED_RESPONSE);
    });

    it('should return success for minimal new payload', () => {
      const errorPayload = createMinimalNewPayload();

      const result = controller.reportFrontendError(errorPayload);

      expect(result).toEqual(EXPECTED_RESPONSE);
    });

    it('should return success for empty payload', () => {
      const errorPayload = createEmptyPayload();

      const result = controller.reportFrontendError(errorPayload);

      expect(result).toEqual(EXPECTED_RESPONSE);
    });
  });
});
