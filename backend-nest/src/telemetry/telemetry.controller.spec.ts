import { Test, TestingModule } from '@nestjs/testing';
import {
  TelemetryController,
  ApiTelemetryController,
} from './telemetry.controller';
import { TelemetryService } from './telemetry.service';
import { FrontendErrorDto } from './dto';

const createMockErrorPayload = (): FrontendErrorDto => ({
  timestamp: new Date().toISOString(),
  pathname: '/audits/123',
  error: {
    name: 'TypeError',
    message: 'Test error',
    stack: 'Error stack trace',
  },
  userAgent: 'Mozilla/5.0 Test',
});

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
    it('should call telemetryService.logFrontendError and return received: true', () => {
      const errorPayload = createMockErrorPayload();
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
      expect(result).toEqual({ received: true });
    });

    it('should work without optional headers', () => {
      const errorPayload = createMockErrorPayload();

      const result = controller.reportFrontendError(errorPayload);

      expect(service.logFrontendError).toHaveBeenCalledWith(
        errorPayload,
        undefined,
        undefined,
      );
      expect(result).toEqual({ received: true });
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
    it('should call telemetryService.logFrontendError and return received: true', () => {
      const errorPayload = createMockErrorPayload();
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
      expect(result).toEqual({ received: true });
    });
  });
});
