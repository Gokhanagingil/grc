import {
  Injectable,
  Logger,
  OnModuleDestroy,
  Optional,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  METRICS_PORT,
  MetricsPort,
  NullMetricsAdapter,
} from './metrics.tokens';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;
  private cacheEnabled = false;
  private readonly defaultTTL = 300; // 5 minutes
  private readonly metrics: MetricsPort;
  
  // Log debounce: track last error log time per error type
  private lastErrorLogTime: Map<string, number> = new Map();
  private readonly DEBOUNCE_MS = 60000; // 60 seconds

  // Auto-reconnect timer (if enabled)
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly autoReconnect: boolean;
  private readonly reconnectIntervalMs = 45000; // 30-60s range, use 45s

  constructor(
    private readonly config: ConfigService,
    @Optional() @Inject(METRICS_PORT) metrics?: MetricsPort,
  ) {
    this.metrics = metrics ?? new NullMetricsAdapter();
    const safeMode =
      process.env.SAFE_MODE === 'true' ||
      this.config.get<string>('SAFE_MODE') === 'true';
    const redisEnabled = !safeMode && this.config.get<string>('REDIS_ENABLED') !== 'false';

    this.autoReconnect = false;

    if (!redisEnabled) {
      this.logger.log('Redis cache disabled (SAFE_MODE or REDIS_ENABLED=false)');
      return;
    }

    this.autoReconnect = this.config.get<string>('REDIS_AUTO_RECONNECT') === 'true';
    this.initializeRedis();
    this.logger.log(
      `Metrics wired: ${metrics ? 'enabled' : 'no-op (using NullMetricsAdapter)'}`,
    );
    if (this.autoReconnect) {
      this.logger.log('Redis auto-reconnect enabled (45s interval)');
    }
  }

  private shouldLogError(errorType: string): boolean {
    const now = Date.now();
    const lastTime = this.lastErrorLogTime.get(errorType) || 0;
    
    if (now - lastTime > this.DEBOUNCE_MS) {
      this.lastErrorLogTime.set(errorType, now);
      return true;
    }
    return false;
  }

  private scheduleReconnect() {
    if (!this.autoReconnect || !this.redis) {
      return;
    }

    // Clear existing timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Schedule reconnect attempt
    this.reconnectTimer = setTimeout(() => {
      if (!this.cacheEnabled && this.redis) {
        this.logger.debug('Attempting Redis reconnection...');
        this.redis.connect().catch((error: any) => {
          // Silent - will retry on next interval
          if (this.shouldLogError('redis_reconnect')) {
            this.logger.debug(`Redis reconnect attempt failed: ${error?.message || error}`);
          }
        });
      }
      // Schedule next attempt
      this.scheduleReconnect();
    }, this.reconnectIntervalMs);
  }

  private initializeRedis() {
    try {
      const url = this.config.get<string>('REDIS_URL');
      let redisOptions: any;

      if (url) {
        const parsed = new URL(url);
        redisOptions = {
          host: parsed.hostname,
          port: Number(parsed.port || 6379),
          password: parsed.password || undefined,
        };
      } else {
        redisOptions = {
          host: this.config.get<string>('REDIS_HOST') || 'localhost',
          port: this.config.get<number>('REDIS_PORT') || 6379,
          password: this.config.get<string>('REDIS_PASSWORD') || undefined,
        };
      }

      // Redis connection options - non-fatal, never crash
      this.redis = new Redis({
        ...redisOptions,
        lazyConnect: true,
        enableReadyCheck: false, // Disable ready check
        enableOfflineQueue: false, // Don't queue commands when offline
        maxRetriesPerRequest: 0, // Never retry - no fatal retries
        retryStrategy: (times) => {
          // Retry strategy but non-blocking
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        reconnectOnError: () => this.autoReconnect, // Auto-reconnect if enabled
      });

      this.redis.on('connect', () => {
        this.cacheEnabled = true;
        this.logger.log('Redis cache connected');
        // Clear reconnect timer if connected
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      });

      this.redis.on('error', (err) => {
        // Never throw - just disable cache and log (debounced)
        const wasEnabled = this.cacheEnabled;
        this.cacheEnabled = false;
        
        // Only log if was enabled (first error) or debounce period passed
        if (wasEnabled && this.shouldLogError('redis_error')) {
          this.logger.warn(
            `Redis cache error (falling back to in-memory): ${err?.message || err}`,
          );
        }
        // If auto-reconnect enabled, schedule reconnect attempt
        if (this.autoReconnect) {
          this.scheduleReconnect();
        }
      });

      // Try to connect (non-blocking, never throw)
      this.redis.connect().catch((error: any) => {
        // Never throw - just disable cache and log (debounced)
        this.cacheEnabled = false;
        if (this.shouldLogError('redis_connect')) {
          this.logger.warn(
            `Redis cache unavailable (falling back to in-memory): ${error?.message || error}`,
          );
        }
        // If auto-reconnect enabled, schedule reconnect attempt
        if (this.autoReconnect) {
          this.scheduleReconnect();
        }
      });

      this.logger.log('Cache: Redis client created (lazyConnect)');
    } catch (e: any) {
      this.cacheEnabled = false;
      this.redis = null;
      if (this.shouldLogError('redis_init')) {
        this.logger.warn(
          `Cache disabled (redis init error): ${e?.message || e}`,
        );
      }
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    if (!this.cacheEnabled || !this.redis) {
      this.metrics.incrementCacheMiss();
      return null;
    }

    try {
      const raw = await this.redis.get(key);
      if (raw == null) {
        this.metrics.incrementCacheMiss();
        return null;
      }
      this.metrics.incrementCacheHit();
      return JSON.parse(raw) as T;
    } catch (e: any) {
      // Silently fail - don't log if cache is disabled (already logged once)
      // Only increment metrics, no logging to prevent spam
      this.metrics.incrementCacheMiss();
      return null;
    }
  }

  async set(key: string, value: any, ttlSec?: number): Promise<boolean> {
    if (!this.cacheEnabled || !this.redis) {
      return false;
    }

    try {
      const ttl = ttlSec ?? this.defaultTTL;
      await this.redis.setex(key, ttl, JSON.stringify(value));
      this.metrics.counter('cache_set');
      return true;
    } catch (e: any) {
      // Silently fail - cache disabled or error, no logging (already logged once on disable)
      // Disable cache if error occurred
      if (this.cacheEnabled) {
        this.cacheEnabled = false;
      }
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.cacheEnabled || !this.redis) {
      return false;
    }

    try {
      await this.redis.del(key);
      this.metrics.counter('cache_del');
      return true;
    } catch (e: any) {
      // Silently fail - cache disabled or error, no logging (already logged once on disable)
      // Disable cache if error occurred
      if (this.cacheEnabled) {
        this.cacheEnabled = false;
      }
      return false;
    }
  }

  async deletePattern(pattern: string): Promise<number> {
    if (!this.cacheEnabled || !this.redis) {
      return 0;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;
      await this.redis.del(...keys);
      return keys.length;
    } catch (e: any) {
      // Silently fail - cache disabled or error, no logging (already logged once on disable)
      // Disable cache if error occurred
      if (this.cacheEnabled) {
        this.cacheEnabled = false;
      }
      return 0;
    }
  }

  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = this.defaultTTL,
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const fresh = await fetchFn();

    // Store in cache (non-blocking)
    await this.set(key, fresh, ttlSeconds).catch(() => {
      // Ignore cache set errors
    });

    return fresh;
  }

  async onModuleDestroy() {
    // Clear reconnect timer to prevent memory leak
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        /* ignore */
      }
      this.redis = null;
    }
  }

  isEnabled(): boolean {
    return this.cacheEnabled && !!this.redis;
  }
}
