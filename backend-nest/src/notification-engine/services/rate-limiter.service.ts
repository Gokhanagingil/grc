import { Injectable } from '@nestjs/common';
import { StructuredLoggerService } from '../../common/logger';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 3600000;

@Injectable()
export class NotificationRateLimiterService {
  private readonly logger: StructuredLoggerService;
  private readonly counters = new Map<string, RateLimitEntry>();

  constructor() {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('NotificationRateLimiterService');
  }

  isAllowed(tenantId: string, ruleId: string, limitPerHour: number): boolean {
    const key = `${tenantId}:${ruleId}`;
    const now = Date.now();
    const entry = this.counters.get(key);

    if (!entry || now - entry.windowStart > WINDOW_MS) {
      this.counters.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= limitPerHour) {
      this.logger.warn('Rate limit exceeded', {
        tenantId,
        ruleId,
        count: entry.count,
        limit: limitPerHour,
      });
      return false;
    }

    entry.count++;
    return true;
  }

  isTenantAllowed(tenantId: string, limitPerHour: number = 1000): boolean {
    const key = `tenant:${tenantId}`;
    const now = Date.now();
    const entry = this.counters.get(key);

    if (!entry || now - entry.windowStart > WINDOW_MS) {
      this.counters.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= limitPerHour) {
      this.logger.warn('Tenant rate limit exceeded', {
        tenantId,
        count: entry.count,
        limit: limitPerHour,
      });
      return false;
    }

    entry.count++;
    return true;
  }

  getRemainingQuota(
    tenantId: string,
    ruleId: string,
    limitPerHour: number,
  ): number {
    const key = `${tenantId}:${ruleId}`;
    const now = Date.now();
    const entry = this.counters.get(key);

    if (!entry || now - entry.windowStart > WINDOW_MS) {
      return limitPerHour;
    }

    return Math.max(0, limitPerHour - entry.count);
  }

  resetCounters(): void {
    this.counters.clear();
  }
}
