import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  const mockDataSource = {
    query: jest.fn(),
    showMigrations: jest.fn(),
    options: {
      migrationsTableName: 'typeorm_migrations',
    },
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkDatabase', () => {
    it('should return healthy status when database is connected', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ '?column?': 1 }]) // SELECT 1
        .mockResolvedValueOnce([
          { name: 'migration1' },
          { name: 'migration2' },
        ]); // migrations query
      mockDataSource.showMigrations.mockResolvedValue(false);

      const result = await service.checkDatabase();

      expect(result.status).toBe('healthy');
      expect(result.details.connected).toBe(true);
      expect(result.details.migrationStatus.executed).toBe(2);
      expect(result.details.migrationStatus.pending).toBe(0);
      expect(result.details.responseTimeMs).toBeGreaterThanOrEqual(0);
      expect(result).toHaveProperty('timestamp');
    });

    it('should return unhealthy status when database connection fails', async () => {
      mockDataSource.query.mockRejectedValue(new Error('Connection failed'));

      const result = await service.checkDatabase();

      expect(result.status).toBe('unhealthy');
      expect(result.details.connected).toBe(false);
      expect(result.details.migrationStatus.executed).toBe(0);
      expect(result.details.migrationStatus.pending).toBe(0);
    });

    it('should indicate pending migrations when showMigrations returns true', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockResolvedValueOnce([{ name: 'migration1' }]);
      mockDataSource.showMigrations.mockResolvedValue(true);

      const result = await service.checkDatabase();

      expect(result.status).toBe('healthy');
      expect(result.details.migrationStatus.pending).toBe(1);
    });
  });

  describe('checkAuth', () => {
    it('should return healthy status when all auth config is present', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config: Record<string, string> = {
          'jwt.secret': 'test-secret',
          'jwt.expiresIn': '24h',
          'jwt.refreshSecret': 'refresh-secret',
          'jwt.refreshExpiresIn': '7d',
        };
        return config[key];
      });

      const result = service.checkAuth();

      expect(result.status).toBe('healthy');
      expect(result.details.jwtConfigured).toBe(true);
      expect(result.details.refreshTokenConfigured).toBe(true);
      expect(result.details.requiredEnvVars.every((v) => v.configured)).toBe(
        true,
      );
    });

    it('should return unhealthy status when JWT_SECRET is missing', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config: Record<string, string | undefined> = {
          'jwt.secret': undefined,
          'jwt.expiresIn': '24h',
          'jwt.refreshSecret': undefined,
          'jwt.refreshExpiresIn': '7d',
        };
        return config[key];
      });

      const result = service.checkAuth();

      expect(result.status).toBe('unhealthy');
      expect(result.details.jwtConfigured).toBe(false);
    });

    it('should return degraded status when JWT is configured but refresh token is not', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config: Record<string, string | undefined> = {
          'jwt.secret': 'test-secret',
          'jwt.expiresIn': undefined,
          'jwt.refreshSecret': undefined,
          'jwt.refreshExpiresIn': undefined,
        };
        return config[key];
      });

      const result = service.checkAuth();

      expect(result.status).toBe('degraded');
      expect(result.details.jwtConfigured).toBe(true);
    });
  });

  describe('checkDotWalking', () => {
    it('should return healthy status when dot-walking works correctly', () => {
      const result = service.checkDotWalking();

      expect(result.status).toBe('healthy');
      expect(result.details.resolverWorking).toBe(true);
      expect(result.details.testPath).toBe('user.email');
      expect(result.details.testResult).toBe('test@example.com');
      expect(result.details.responseTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getOverallHealth', () => {
    it('should return healthy when all checks pass', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockResolvedValueOnce([{ name: 'migration1' }]);
      mockDataSource.showMigrations.mockResolvedValue(false);
      mockConfigService.get.mockImplementation((key: string) => {
        const config: Record<string, string> = {
          'jwt.secret': 'test-secret',
          'jwt.expiresIn': '24h',
          'jwt.refreshSecret': 'refresh-secret',
          'jwt.refreshExpiresIn': '7d',
        };
        return config[key];
      });

      const result = await service.getOverallHealth();

      expect(result.status).toBe('healthy');
      expect(result.checks).toHaveProperty('db');
      expect(result.checks).toHaveProperty('auth');
      expect(result.checks).toHaveProperty('dotWalking');
    });

    it('should return unhealthy when database check fails', async () => {
      mockDataSource.query.mockRejectedValue(new Error('Connection failed'));
      mockConfigService.get.mockImplementation((key: string) => {
        const config: Record<string, string> = {
          'jwt.secret': 'test-secret',
          'jwt.expiresIn': '24h',
          'jwt.refreshSecret': 'refresh-secret',
          'jwt.refreshExpiresIn': '7d',
        };
        return config[key];
      });

      const result = await service.getOverallHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.db.status).toBe('unhealthy');
    });

    it('should return degraded when auth check is degraded', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockResolvedValueOnce([{ name: 'migration1' }]);
      mockDataSource.showMigrations.mockResolvedValue(false);
      mockConfigService.get.mockImplementation((key: string) => {
        const config: Record<string, string | undefined> = {
          'jwt.secret': 'test-secret',
          'jwt.expiresIn': undefined,
          'jwt.refreshSecret': undefined,
          'jwt.refreshExpiresIn': undefined,
        };
        return config[key];
      });

      const result = await service.getOverallHealth();

      expect(result.status).toBe('degraded');
      expect(result.checks.auth.status).toBe('degraded');
    });
  });
});
