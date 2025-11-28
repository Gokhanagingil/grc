import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';
import { MetricsService } from '../../modules/metrics/metrics.service';

describe('CacheService', () => {
  let service: CacheService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'REDIS_URL') return undefined; // Simulate Redis unavailable
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should fallback to in-memory cache when Redis is unavailable', async () => {
    // Set a value
    await service.set('test-key', 'test-value', 300);

    // Get the value (should work with in-memory fallback)
    const value = await service.get('test-key');
    expect(value).toBe('test-value');
  });

  it('should handle getOrSet with in-memory fallback', async () => {
    const fn = jest.fn(async () => 'computed-value');

    const result1 = await service.getOrSet('test-key-2', fn, 300);
    expect(result1).toBe('computed-value');
    expect(fn).toHaveBeenCalledTimes(1);

    // Second call should use cache (in-memory)
    const result2 = await service.getOrSet('test-key-2', fn, 300);
    expect(result2).toBe('computed-value');
    expect(fn).toHaveBeenCalledTimes(1); // Should not call again
  });

  it('should handle delete with in-memory fallback', async () => {
    await service.set('test-key-3', 'test-value', 300);
    await service.delete('test-key-3');

    const value = await service.get('test-key-3');
    expect(value).toBeNull();
  });
});

