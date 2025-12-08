import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: jest.Mocked<HealthService>;

  const mockHealthService = {
    getOverallHealth: jest.fn(),
    checkDatabase: jest.fn(),
    checkAuth: jest.fn(),
    checkDotWalking: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthService = module.get(HealthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('live', () => {
    it('should return liveness status with uptime', () => {
      const result = controller.live();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('service', 'grc-platform-nest');
      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return valid ISO timestamp', () => {
      const result = controller.live();

      const timestamp = new Date(result.timestamp);
      expect(timestamp.toISOString()).toBe(result.timestamp);
    });
  });

  describe('ready', () => {
    it('should return ok status when database is connected', async () => {
      mockHealthService.checkDatabase.mockResolvedValue({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        details: {
          connected: true,
          migrationStatus: { pending: 0, executed: 5, lastMigration: 'test' },
          lastBackupTimestamp: null,
          responseTimeMs: 10,
        },
      });

      const result = await controller.ready();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('service', 'grc-platform-nest');
      expect(result.checks).toHaveProperty('database');
      expect(healthService.checkDatabase).toHaveBeenCalled();
    });

    it('should return degraded status when database is not connected', async () => {
      mockHealthService.checkDatabase.mockResolvedValue({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: {
          connected: false,
          migrationStatus: { pending: 0, executed: 0, lastMigration: null },
          lastBackupTimestamp: null,
          responseTimeMs: 0,
        },
      });

      const result = await controller.ready();

      expect(result).toHaveProperty('status', 'degraded');
      expect(result.checks.database.details.connected).toBe(false);
    });
  });

  describe('getOverallHealth', () => {
    it('should return overall health status', async () => {
      const mockOverallHealth = {
        status: 'healthy' as const,
        timestamp: new Date().toISOString(),
        checks: {
          db: {
            status: 'healthy' as const,
            timestamp: new Date().toISOString(),
            details: {
              connected: true,
              migrationStatus: {
                pending: 0,
                executed: 5,
                lastMigration: 'test',
              },
              lastBackupTimestamp: null,
              responseTimeMs: 10,
            },
          },
          auth: {
            status: 'healthy' as const,
            timestamp: new Date().toISOString(),
            details: {
              jwtConfigured: true,
              refreshTokenConfigured: true,
              requiredEnvVars: [],
            },
          },
          dotWalking: {
            status: 'healthy' as const,
            timestamp: new Date().toISOString(),
            details: {
              resolverWorking: true,
              testPath: 'user.email',
              testResult: 'test@example.com',
              responseTimeMs: 1,
            },
          },
        },
      };

      mockHealthService.getOverallHealth.mockResolvedValue(mockOverallHealth);

      const result = await controller.getOverallHealth();

      expect(result).toEqual(mockOverallHealth);
      expect(healthService.getOverallHealth).toHaveBeenCalled();
    });
  });

  describe('checkDatabase', () => {
    it('should return database health status', async () => {
      const mockDbHealth = {
        status: 'healthy' as const,
        timestamp: new Date().toISOString(),
        details: {
          connected: true,
          migrationStatus: { pending: 0, executed: 5, lastMigration: 'test' },
          lastBackupTimestamp: null,
          responseTimeMs: 10,
        },
      };

      mockHealthService.checkDatabase.mockResolvedValue(mockDbHealth);

      const result = await controller.checkDatabase();

      expect(result).toEqual(mockDbHealth);
      expect(healthService.checkDatabase).toHaveBeenCalled();
    });
  });

  describe('checkAuth', () => {
    it('should return auth health status', () => {
      const mockAuthHealth = {
        status: 'healthy' as const,
        timestamp: new Date().toISOString(),
        details: {
          jwtConfigured: true,
          refreshTokenConfigured: true,
          requiredEnvVars: [
            { name: 'JWT_SECRET', configured: true },
            { name: 'JWT_EXPIRES_IN', configured: true },
          ],
        },
      };

      mockHealthService.checkAuth.mockReturnValue(mockAuthHealth);

      const result = controller.checkAuth();

      expect(result).toEqual(mockAuthHealth);
      expect(healthService.checkAuth).toHaveBeenCalled();
    });
  });

  describe('checkDotWalking', () => {
    it('should return dot-walking health status', () => {
      const mockDotWalkingHealth = {
        status: 'healthy' as const,
        timestamp: new Date().toISOString(),
        details: {
          resolverWorking: true,
          testPath: 'user.email',
          testResult: 'test@example.com',
          responseTimeMs: 1,
        },
      };

      mockHealthService.checkDotWalking.mockReturnValue(mockDotWalkingHealth);

      const result = controller.checkDotWalking();

      expect(result).toEqual(mockDotWalkingHealth);
      expect(healthService.checkDotWalking).toHaveBeenCalled();
    });
  });
});
