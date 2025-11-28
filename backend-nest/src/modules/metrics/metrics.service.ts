import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsPort } from '../../common/services/metrics.tokens';

@Injectable()
export class MetricsService implements MetricsPort {
  private readonly logger = new Logger(MetricsService.name);
  private metricsEnabled = false;
  private register: any;

  private static globalRegister: any = null; // Singleton register to avoid duplicates

  constructor(private readonly config: ConfigService) {
    this.metricsEnabled = this.config.get<string>('METRICS_ENABLED') === 'true';

    if (this.metricsEnabled) {
      try {
        // Use singleton register if available, otherwise create new one
        if (MetricsService.globalRegister) {
          this.register = MetricsService.globalRegister;
          this.logger.log('Using existing Prometheus register');
        } else {
          const { Registry, collectDefaultMetrics } = require('prom-client');
          this.register = new Registry();
          MetricsService.globalRegister = this.register; // Store as singleton
          collectDefaultMetrics({ register: this.register });

          // Additional custom metrics (only initialize once)
          const { Counter, Histogram, Gauge } = require('prom-client');

        // HTTP request metrics (will be populated by interceptor)
        new Counter({
          name: 'http_requests_total',
          help: 'Total number of HTTP requests',
          labelNames: ['method', 'route', 'status', 'tenant_id'],
          registers: [this.register],
        });

        new Histogram({
          name: 'http_request_duration_ms_bucket',
          help: 'Duration of HTTP requests in milliseconds',
          labelNames: ['method', 'route', 'status', 'tenant_id'],
          buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
          registers: [this.register],
        });

        // Rate limit counter
        new Counter({
          name: '429_total',
          help: 'Total number of rate limit (429) responses',
          labelNames: ['route', 'tenant_id'],
          registers: [this.register],
        });

        // App build info
        new Gauge({
          name: 'app_build_info',
          help: 'Application build information',
          labelNames: ['version', 'env'],
          registers: [this.register],
        }).set(
          { version: '0.1.0', env: process.env.NODE_ENV || 'development' },
          1,
        );

        // Cache hit counter
        new Counter({
          name: 'cache_hit_total',
          help: 'Total number of cache hits',
          labelNames: ['cache_key_pattern'],
          registers: [this.register],
        });

        // WebSocket broadcast counter
        new Counter({
          name: 'ws_broadcast_total',
          help: 'Total number of WebSocket broadcasts',
          labelNames: ['event'],
          registers: [this.register],
        });

        // Audit findings open gauge
        new Gauge({
          name: 'audit_findings_open_total',
          help: 'Total number of open audit findings',
          labelNames: ['tenant_id'],
          registers: [this.register],
        });

        // Audit CAPs open gauge
        new Gauge({
          name: 'audit_caps_open_total',
          help: 'Total number of open corrective actions (CAPs)',
          labelNames: ['tenant_id'],
          registers: [this.register],
        });

        // BCM process count gauge
        new Gauge({
          name: 'bcm_process_count',
          help: 'Total number of BIA processes',
          labelNames: ['tenant_id'],
          registers: [this.register],
        });

        // BCM plan count gauge
        new Gauge({
          name: 'bcm_plan_count',
          help: 'Total number of BCP plans',
          labelNames: ['tenant_id'],
          registers: [this.register],
        });

        // BCM exercise count gauge
        new Gauge({
          name: 'bcm_exercise_count',
          help: 'Total number of BCP exercises',
          labelNames: ['tenant_id'],
          registers: [this.register],
        });

          this.logger.log('Prometheus metrics enabled (register initialized)');
        }
      } catch (error: any) {
        // Silently disable metrics - don't log if prom-client not available
        this.metricsEnabled = false;
        this.register = null;
      }
    } else {
      // Metrics disabled via env - no-op
      this.metricsEnabled = false;
      this.register = null;
    }
  }

  async getMetrics(): Promise<string> {
    if (!this.metricsEnabled || !this.register) {
      return '# Metrics disabled. Set METRICS_ENABLED=true to enable.';
    }

    try {
      return await this.register.metrics();
    } catch (error: any) {
      this.logger.error('Error generating metrics:', error?.message || error);
      return '# Error generating metrics';
    }
  }

  /**
   * Get a counter by name (for manual increments)
   */
  getCounter(name: string): any {
    if (!this.metricsEnabled || !this.register) {
      return null;
    }
    try {
      return this.register.getSingleMetric(name);
    } catch {
      return null;
    }
  }

  /**
   * Get a gauge by name (for manual sets)
   */
  getGauge(name: string): any {
    if (!this.metricsEnabled || !this.register) {
      return null;
    }
    try {
      return this.register.getSingleMetric(name);
    } catch {
      return null;
    }
  }

  /**
   * Check if metrics are enabled
   */
  isEnabled(): boolean {
    return this.metricsEnabled;
  }

  /**
   * MetricsPort interface implementation
   */
  incrementCacheHit(): void {
    if (!this.metricsEnabled || !this.register) {
      return;
    }
    try {
      const counter = this.getCounter('cache_hit_total');
      if (counter) {
        counter.inc({ cache_key_pattern: 'default' });
      }
    } catch (error: any) {
      // Ignore metrics errors
    }
  }

  incrementCacheMiss(): void {
    if (!this.metricsEnabled || !this.register) {
      return;
    }
    try {
      // You can add a cache_miss_total counter if needed
      // For now, we'll just track hits
    } catch (error: any) {
      // Ignore metrics errors
    }
  }

  counter(name: string): void {
    if (!this.metricsEnabled || !this.register) {
      return;
    }
    try {
      const metric = this.getCounter(name);
      if (metric) {
        metric.inc();
      }
    } catch (error: any) {
      // Ignore metrics errors
    }
  }
}
