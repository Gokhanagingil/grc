import { Controller, Get, Head, Req, Optional, Version, VERSION_NEUTRAL } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Request } from 'express';
import {
  StandardEntity,
  StandardClauseEntity,
  ControlLibraryEntity,
  RiskCatalogEntity,
  StandardMappingEntity,
} from '../entities/app';

// Root health endpoint (no prefix, no version)
// VERSION_NEUTRAL ensures it's not captured by URI versioning
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class RootHealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async rootHealth() {
    // Standard health schema - always returns 200
    const deps: any = {
      db: 'down',
      redis: 'disabled',
      queue: 'disabled',
      metrics: 'disabled',
    };

    // Quick DB check (non-blocking, timeout 500ms)
    try {
      await Promise.race([
        this.dataSource.query('SELECT 1'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 500),
        ),
      ]);
      deps.db = 'ok';
    } catch {
      deps.db = 'down';
    }

    // Redis check (non-blocking)
    const redisUrl = this.config.get<string>('REDIS_URL');
    const redisHost = this.config.get<string>('REDIS_HOST');
    if (redisUrl || redisHost) {
      deps.redis = 'down'; // Will be checked if Redis is configured
    } else {
      deps.redis = 'disabled';
    }

    // Queue check
    const enableQueue = this.config.get<string>('ENABLE_QUEUE') !== 'false';
    if (enableQueue && (redisUrl || redisHost)) {
      deps.queue = 'down'; // Will be checked if Queue is enabled
    } else {
      deps.queue = 'disabled';
    }

    // Metrics check
    const enableMetrics = this.config.get<string>('ENABLE_METRICS') !== 'false';
    const metricsEnabled = this.config.get<string>('METRICS_ENABLED') === 'true';
    if (enableMetrics && metricsEnabled) {
      deps.metrics = 'ok'; // Assumed ok if enabled
    } else {
      deps.metrics = 'disabled';
    }

    return {
      status: 'ok',
      time: new Date().toISOString(),
      deps,
    };
  }

  @Head('health')
  okHead() {
    // HEAD request returns 200 with empty body
    return;
  }
}

// API health endpoint (with prefix and version)
@Controller({ path: 'health', version: '2' })
export class HealthController {
  constructor(
    @Optional() @InjectQueue('events.raw') private readonly rawQueue: Queue | null,
    @Optional() @InjectQueue('events.dlq') private readonly dlqQueue: Queue | null,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(StandardEntity)
    private readonly standardRepo: Repository<StandardEntity>,
    @InjectRepository(StandardClauseEntity)
    private readonly clauseRepo: Repository<StandardClauseEntity>,
    @InjectRepository(ControlLibraryEntity)
    private readonly controlRepo: Repository<ControlLibraryEntity>,
    @InjectRepository(RiskCatalogEntity)
    private readonly riskRepo: Repository<RiskCatalogEntity>,
    @InjectRepository(StandardMappingEntity)
    private readonly mappingRepo: Repository<StandardMappingEntity>,
  ) {}

  @Get()
  async getHealth(@Req() req: Request) {
    // Standard health schema - always returns 200
    const deps: any = {
      db: 'down',
      redis: 'disabled',
      queue: 'disabled',
      metrics: 'disabled',
    };

    // Quick DB check (non-blocking, timeout 500ms)
    try {
      await Promise.race([
        this.dataSource.query('SELECT 1'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 500),
        ),
      ]);
      deps.db = 'ok';
    } catch {
      deps.db = 'down';
    }

    // Redis check (non-blocking) - optimized: parse URL once
    const redisUrl = this.config.get<string>('REDIS_URL');
    const redisHost = this.config.get<string>('REDIS_HOST');
    if (redisUrl || redisHost) {
      // Try quick ping (non-blocking, timeout 500ms)
      let testRedis: any = null;
      try {
        const Redis = require('ioredis');
        
        // Parse URL once and extract connection params
        let redisHostname: string;
        let redisPort: number;
        let redisPassword: string | undefined;

        if (redisUrl) {
          const parsedUrl = new URL(redisUrl);
          redisHostname = parsedUrl.hostname;
          redisPort = parseInt(parsedUrl.port || '6379', 10);
          redisPassword = parsedUrl.password || undefined;
        } else {
          redisHostname = redisHost || 'localhost';
          redisPort = this.config.get<number>('REDIS_PORT') || 6379;
          redisPassword = this.config.get<string>('REDIS_PASSWORD') || undefined;
        }

        testRedis = new Redis({
          host: redisHostname,
          port: redisPort,
          password: redisPassword,
          connectTimeout: 500,
          enableReadyCheck: false,
          maxRetriesPerRequest: 0,
          lazyConnect: true,
        });

        await Promise.race([
          testRedis.ping(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 500),
          ),
        ]);
        deps.redis = 'ok';
      } catch {
        deps.redis = 'down';
      } finally {
        // Clean up: disconnect if connected
        if (testRedis) {
          try {
            await testRedis.quit();
          } catch {
            // Ignore quit errors
          }
        }
      }
    } else {
      deps.redis = 'disabled';
    }

    // Queue check (if Redis is available and Queue is enabled)
    const enableQueue = this.config.get<string>('ENABLE_QUEUE') !== 'false';
    if (enableQueue && this.rawQueue && deps.redis === 'ok') {
      try {
        const waiting = await Promise.race([
          this.rawQueue.getWaitingCount().catch(() => 0),
          new Promise<number>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 500),
          ),
        ]);
        deps.queue = 'ok';
      } catch {
        deps.queue = 'down';
      }
    } else {
      deps.queue = 'disabled';
    }

    // Metrics check
    const enableMetrics = this.config.get<string>('ENABLE_METRICS') !== 'false';
    const metricsEnabled = this.config.get<string>('METRICS_ENABLED') === 'true';
    if (enableMetrics && metricsEnabled) {
      try {
        // Try to check if prom-client is available
        require('prom-client');
        deps.metrics = 'ok';
      } catch {
        deps.metrics = 'down';
      }
    } else {
      deps.metrics = 'disabled';
    }

    // Get tenant ID from header or default
    const headerTenant = req.headers['x-tenant-id'] as string | undefined;
    const tenantId =
      headerTenant || this.config.get<string>('DEFAULT_TENANT_ID');

    // Get data foundations counts (with error handling per field)
    const dataFoundations: any = {
      standards: 0,
      clauses: 0,
      clausesSynthetic: 0,
      controls: 0,
      risks: 0,
      mappings: 0,
      mappingsSynthetic: 0,
    };

    if (tenantId) {
      // Count each field separately with try/catch (non-blocking)
      try {
        dataFoundations.standards = await this.standardRepo.count({
          where: { tenant_id: tenantId },
        });
      } catch (error: any) {
        // Ignore count errors
      }

      try {
        dataFoundations.clauses = await this.clauseRepo.count({
          where: { tenant_id: tenantId },
        });
      } catch (error: any) {
        // Ignore count errors
      }

      try {
        dataFoundations.clausesSynthetic = await this.clauseRepo.count({
          where: { tenant_id: tenantId, synthetic: true },
        });
      } catch (error: any) {
        // Ignore count errors
      }

      try {
        dataFoundations.controls = await this.controlRepo.count({
          where: { tenant_id: tenantId },
        });
      } catch (error: any) {
        // Ignore count errors
      }

      try {
        dataFoundations.risks = await this.riskRepo.count({
          where: { tenant_id: tenantId },
        });
      } catch (error: any) {
        // Ignore count errors
      }

      try {
        dataFoundations.mappings = await this.mappingRepo.count({
          where: { tenant_id: tenantId },
        });
      } catch (error: any) {
        // Ignore count errors
      }

      try {
        dataFoundations.mappingsSynthetic = await this.mappingRepo.count({
          where: { tenant_id: tenantId, synthetic: true },
        });
      } catch (error: any) {
        // Ignore count errors
      }
    }

    return {
      status: 'ok',
      time: new Date().toISOString(),
      deps,
      tenantId: tenantId || null,
      dataFoundations,
    };
  }
}
