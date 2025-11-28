import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService, ModuleRef } from '@nestjs/core';

@Injectable()
export class BootInspector implements OnApplicationBootstrap {
  private readonly logger = new Logger('BootInspector');

  constructor(
    private readonly disc: DiscoveryService,
    private readonly modRef: ModuleRef,
  ) {}

  onApplicationBootstrap() {
    try {
      const ctrls = this.disc.getControllers();
      const provs = this.disc.getProviders();

      this.logger.log(
        `✅ Boot complete: controllers=${ctrls.length} providers=${provs.length}`,
      );

      // Probe critical providers (non-fatal)
      const tokens = [
        'CacheService',
        'MetricsService',
        'QueueService',
        'AuthService',
        'UsersService',
      ];

      tokens.forEach((t) => {
        try {
          const ref = this.modRef.get(t as any, { strict: false });
          if (ref) {
            this.logger.log(`✅ probe: ${t} -> OK`);
          } else {
            this.logger.warn(`⚠️  probe: ${t} -> not found`);
          }
        } catch (e: any) {
          this.logger.warn(`⚠️  probe: ${t} -> ${e?.message || e}`);
        }
      });

      // Log feature flags status
      const features = [
        'ENABLE_POLICY',
        'ENABLE_RISK',
        'ENABLE_COMPLIANCE',
        'ENABLE_AUDIT',
        'ENABLE_ISSUE',
        'ENABLE_QUEUE',
        'ENABLE_RULES',
        'ENABLE_DATA_FOUNDATION',
        'ENABLE_DASHBOARD',
        'ENABLE_GOVERNANCE',
        'ENABLE_RISK_INSTANCE',
        'ENABLE_RISK_SCORING',
        'ENABLE_SEARCH',
        'ENABLE_ENTITY_REGISTRY',
        'ENABLE_METRICS',
        'ENABLE_BCM',
      ];

      const enabledFeatures = features.filter(
        (f) => process.env[f] === 'true',
      );
      const disabledFeatures = features.filter(
        (f) => process.env[f] === 'false',
      );

      if (enabledFeatures.length > 0) {
        this.logger.log(`✅ Enabled features: ${enabledFeatures.join(', ')}`);
      }
      if (disabledFeatures.length > 0) {
        this.logger.log(
          `⚠️  Disabled features: ${disabledFeatures.join(', ')}`,
        );
      }
    } catch (error: any) {
      this.logger.error(`❌ BootInspector error: ${error?.message || error}`);
    }
  }
}

