import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';

import {
  AiSuggestionsPolicy,
  AiSuggestionsProviderMode,
  AI_SUGGESTIONS_ALLOWED_ACTION_TYPES,
  AI_SUGGESTIONS_ALLOWED_INPUT_FIELDS,
} from './entities/ai-suggestions-policy.entity';
import { AiAuditEvent, AiActionType, AiAuditStatus } from './entities/ai-audit-event.entity';
import { SysUserNotification } from '../notification-engine/entities/sys-user-notification.entity';
import {
  AiAdvisorProvider,
  AiAdvisorInput,
  AiAdviceOutput,
} from './providers/ai-advisor-provider.interface';
import { StubAdvisorProvider } from './providers/stub-advisor.provider';
import { RealAdvisorProvider } from './providers/real-advisor.provider';
import { validateAiAdviceOutput, clampActionsToPolicy } from './ai-advice.schema';

/**
 * Cached AI Advice stored in notification metadata.
 */
export interface CachedAiAdvice extends AiAdviceOutput {
  inputHash: string;
  ttl: number;
  cachedAt: string;
}

/**
 * Rate limit tracker (in-memory for v0).
 */
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

@Injectable()
export class AiSuggestionsService {
  private readonly logger = new Logger(AiSuggestionsService.name);

  /** Per-user per-minute rate limit tracker */
  private readonly userRateLimits = new Map<string, RateLimitEntry>();

  /** Per-tenant per-day rate limit tracker */
  private readonly tenantRateLimits = new Map<string, RateLimitEntry>();

  /** Provider instances */
  private readonly stubProvider: AiAdvisorProvider;
  private readonly realProvider: AiAdvisorProvider;

  constructor(
    @InjectRepository(AiSuggestionsPolicy)
    private readonly policyRepo: Repository<AiSuggestionsPolicy>,
    @InjectRepository(AiAuditEvent)
    private readonly auditRepo: Repository<AiAuditEvent>,
    @InjectRepository(SysUserNotification)
    private readonly notificationRepo: Repository<SysUserNotification>,
  ) {
    this.stubProvider = new StubAdvisorProvider();
    this.realProvider = new RealAdvisorProvider();
  }

  // ── Policy CRUD ────────────────────────────────────────────────────

  async getPolicy(tenantId: string): Promise<AiSuggestionsPolicy | null> {
    return this.policyRepo.findOne({ where: { tenantId } });
  }

  async upsertPolicy(
    tenantId: string,
    data: Partial<AiSuggestionsPolicy>,
  ): Promise<AiSuggestionsPolicy> {
    let policy = await this.policyRepo.findOne({ where: { tenantId } });

    if (!policy) {
      // Apply same validation as update path
      const validated: Partial<AiSuggestionsPolicy> = { tenantId };
      if (data.aiSuggestionsEnabled !== undefined) {
        validated.aiSuggestionsEnabled = data.aiSuggestionsEnabled;
      }
      if (data.providerMode !== undefined) {
        validated.providerMode = data.providerMode;
      }
      if (data.allowedActionTypes !== undefined) {
        validated.allowedActionTypes = data.allowedActionTypes.filter((t) =>
          (AI_SUGGESTIONS_ALLOWED_ACTION_TYPES as readonly string[]).includes(t),
        );
      }
      if (data.allowedInputFields !== undefined) {
        validated.allowedInputFields = data.allowedInputFields.filter((f) =>
          (AI_SUGGESTIONS_ALLOWED_INPUT_FIELDS as readonly string[]).includes(f),
        );
      }
      // v0: always true, ignore any attempt to set false
      validated.requiresConfirm = true;
      if (data.rateLimitPerUserPerMinute !== undefined) {
        validated.rateLimitPerUserPerMinute = Math.max(1, Math.min(60, data.rateLimitPerUserPerMinute));
      }
      if (data.rateLimitPerTenantPerDay !== undefined) {
        validated.rateLimitPerTenantPerDay = Math.max(0, data.rateLimitPerTenantPerDay);
      }
      if (data.cacheTtlSeconds !== undefined) {
        validated.cacheTtlSeconds = Math.max(60, Math.min(3600, data.cacheTtlSeconds));
      }
      policy = this.policyRepo.create(validated);
    } else {
      // Update allowed fields
      if (data.aiSuggestionsEnabled !== undefined) {
        policy.aiSuggestionsEnabled = data.aiSuggestionsEnabled;
      }
      if (data.providerMode !== undefined) {
        policy.providerMode = data.providerMode;
      }
      if (data.allowedActionTypes !== undefined) {
        // Enforce: only allow known action types
        policy.allowedActionTypes = data.allowedActionTypes.filter((t) =>
          (AI_SUGGESTIONS_ALLOWED_ACTION_TYPES as readonly string[]).includes(t),
        );
      }
      if (data.allowedInputFields !== undefined) {
        // Enforce: only allow known input fields
        policy.allowedInputFields = data.allowedInputFields.filter((f) =>
          (AI_SUGGESTIONS_ALLOWED_INPUT_FIELDS as readonly string[]).includes(f),
        );
      }
      if (data.requiresConfirm !== undefined) {
        // v0: always true, ignore any attempt to set false
        policy.requiresConfirm = true;
      }
      if (data.rateLimitPerUserPerMinute !== undefined) {
        policy.rateLimitPerUserPerMinute = Math.max(1, Math.min(60, data.rateLimitPerUserPerMinute));
      }
      if (data.rateLimitPerTenantPerDay !== undefined) {
        policy.rateLimitPerTenantPerDay = Math.max(0, data.rateLimitPerTenantPerDay);
      }
      if (data.cacheTtlSeconds !== undefined) {
        policy.cacheTtlSeconds = Math.max(60, Math.min(3600, data.cacheTtlSeconds));
      }
    }

    return this.policyRepo.save(policy);
  }

  // ── Rate Limiting ──────────────────────────────────────────────────

  /**
   * Check and consume a rate limit slot for user-per-minute.
   * Returns true if allowed, false if rate limited.
   */
  checkUserRateLimit(userId: string, limit: number): boolean {
    const key = `user:${userId}`;
    const now = Date.now();
    const windowMs = 60_000; // 1 minute

    const entry = this.userRateLimits.get(key);
    if (!entry || now - entry.windowStart > windowMs) {
      this.userRateLimits.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= limit) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Check and consume a rate limit slot for tenant-per-day.
   * Returns true if allowed, false if rate limited.
   * If limit is 0, it's unlimited.
   */
  checkTenantRateLimit(tenantId: string, limit: number): boolean {
    if (limit === 0) return true; // unlimited

    const key = `tenant:${tenantId}`;
    const now = Date.now();
    const windowMs = 86_400_000; // 24 hours

    const entry = this.tenantRateLimits.get(key);
    if (!entry || now - entry.windowStart > windowMs) {
      this.tenantRateLimits.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= limit) {
      return false;
    }

    entry.count++;
    return true;
  }

  // ── Input Building (Data Minimization) ─────────────────────────────

  /**
   * Build minimal input payload per Data Minimization Policy.
   * Only includes fields explicitly allowed in the policy.
   */
  buildMinimalInput(
    notification: SysUserNotification,
    allowedFields: string[],
  ): AiAdvisorInput {
    const fieldSet = new Set(allowedFields);
    const metadata = (notification.metadata || {}) as Record<string, unknown>;
    const snapshot = metadata.snapshot as {
      primaryLabel?: string;
      secondaryLabel?: string;
      keyFields?: Array<{ label: string; value: string }>;
    } | undefined;

    return {
      notificationType: fieldSet.has('notification.type')
        ? notification.type || 'GENERAL'
        : 'GENERAL',
      notificationSeverity: fieldSet.has('notification.severity')
        ? notification.severity || 'INFO'
        : 'INFO',
      notificationDueAt: fieldSet.has('notification.dueAt')
        ? notification.dueAt?.toISOString() ?? null
        : null,
      entityType: fieldSet.has('notification.entityType')
        ? notification.entityType || null
        : null,
      snapshot: snapshot
        ? {
            primaryLabel: fieldSet.has('snapshot.primaryLabel')
              ? snapshot.primaryLabel || ''
              : '',
            secondaryLabel: fieldSet.has('snapshot.secondaryLabel')
              ? snapshot.secondaryLabel
              : undefined,
            keyFields: fieldSet.has('snapshot.keyFields')
              ? (snapshot.keyFields || []).slice(0, 10)
              : [],
          }
        : null,
    };
  }

  /**
   * Compute SHA-256 hash of input payload (for audit, not raw storage).
   */
  computeInputHash(input: AiAdvisorInput): string {
    return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
  }

  // ── Caching ────────────────────────────────────────────────────────

  /**
   * Get cached AI advice from notification metadata.
   * Returns null if no cache or if cache has expired.
   */
  getCachedAdvice(
    notification: SysUserNotification,
    ttlSeconds: number,
  ): CachedAiAdvice | null {
    const metadata = (notification.metadata || {}) as Record<string, unknown>;
    const cached = metadata.aiAdvice as CachedAiAdvice | undefined;

    if (!cached || !cached.cachedAt) return null;

    const cachedAt = new Date(cached.cachedAt).getTime();
    const now = Date.now();
    const elapsed = (now - cachedAt) / 1000;

    if (elapsed > ttlSeconds) return null;

    return cached;
  }

  /**
   * Store AI advice in notification metadata.
   */
  async cacheAdvice(
    notificationId: string,
    tenantId: string,
    advice: AiAdviceOutput,
    inputHash: string,
    ttlSeconds: number,
  ): Promise<void> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId, tenantId },
    });
    if (!notification) return;

    const metadata = (notification.metadata || {}) as Record<string, unknown>;
    metadata.aiAdvice = {
      ...advice,
      inputHash,
      ttl: ttlSeconds,
      cachedAt: new Date().toISOString(),
    } as CachedAiAdvice;

    await this.notificationRepo.update(notificationId, {
      metadata: metadata,
    } as any);
  }

  // ── Core AI Advice Generation ──────────────────────────────────────

  /**
   * Generate AI advice for a notification.
   *
   * Full flow:
   * 1. Check AI Suggestions enabled (global/tenant)
   * 2. Check rate limits
   * 3. Check cache (return cached if within TTL, unless refresh=true)
   * 4. Build minimal input per Data Minimization Policy
   * 5. Call provider
   * 6. Validate response against JSON schema
   * 7. Clamp actions to allowed types
   * 8. Enforce requiresConfirm on all actions
   * 9. Cache result
   * 10. Log audit event
   * 11. Return advice
   */
  async generateAdvice(
    tenantId: string,
    userId: string,
    notificationId: string,
    refresh: boolean = false,
  ): Promise<AiAdviceOutput> {
    const startTime = Date.now();

    // 1. Get policy (or defaults)
    const policy = await this.getOrCreateDefaultPolicy(tenantId);

    // Check kill switch
    if (!policy.aiSuggestionsEnabled) {
      throw new ForbiddenException('AI Suggestions are disabled for this tenant');
    }

    // 2. Get notification
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId, tenantId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    // Ensure tenant isolation: notification must belong to requesting user
    if (notification.userId !== userId) {
      throw new ForbiddenException('Cannot access notifications of other users');
    }

    // 3. Check cache (before rate limits so cache hits don't consume slots)
    if (!refresh) {
      const cached = this.getCachedAdvice(notification, policy.cacheTtlSeconds);
      if (cached) {
        // Re-clamp cached advice against current policy (admin may have changed allowlist)
        return clampActionsToPolicy(cached, policy.allowedActionTypes);
      }
    }

    // 4. Check rate limits (only consumed when we actually need the AI provider)
    if (!this.checkUserRateLimit(userId, policy.rateLimitPerUserPerMinute)) {
      throw new HttpException(
        {
          statusCode: 429,
          message: `Rate limit exceeded: max ${policy.rateLimitPerUserPerMinute} suggestions per minute`,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!this.checkTenantRateLimit(tenantId, policy.rateLimitPerTenantPerDay)) {
      throw new HttpException(
        {
          statusCode: 429,
          message: 'Tenant daily suggestion budget exceeded',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 5. Build minimal input
    const input = this.buildMinimalInput(notification, policy.allowedInputFields);
    const inputHash = this.computeInputHash(input);

    // 6. Call provider
    const provider = this.resolveProvider(policy.providerMode);
    let rawAdvice: AiAdviceOutput;

    try {
      rawAdvice = await provider.generateAdvice(input);
    } catch (error) {
      const latency = Date.now() - startTime;
      await this.logAdviceEvent(tenantId, userId, notificationId, provider.providerName, inputHash, AiAuditStatus.FAIL, latency, []);
      throw error;
    }

    // 7. Validate against schema
    const validation = validateAiAdviceOutput(rawAdvice);
    if (!validation.valid || !validation.sanitized) {
      const latency = Date.now() - startTime;
      await this.logAdviceEvent(tenantId, userId, notificationId, provider.providerName, inputHash, AiAuditStatus.FAIL, latency, []);
      this.logger.error('AI advice output failed schema validation', {
        errors: validation.errors,
      });
      throw new BadRequestException('AI provider returned invalid output');
    }

    // 8. Clamp actions to allowed types
    let advice = clampActionsToPolicy(validation.sanitized, policy.allowedActionTypes);

    // 9. Enforce requiresConfirm on all actions (v0: non-negotiable)
    advice = {
      ...advice,
      suggestedActions: advice.suggestedActions.map((a) => ({
        ...a,
        payload: { ...a.payload, requiresConfirm: true },
      })),
    };

    // 10. Cache result
    await this.cacheAdvice(notificationId, tenantId, advice, inputHash, policy.cacheTtlSeconds);

    // 11. Log audit event
    const latency = Date.now() - startTime;
    const suggestedActionTypes = advice.suggestedActions.map((a) => a.actionType);
    await this.logAdviceEvent(
      tenantId,
      userId,
      notificationId,
      provider.providerName,
      inputHash,
      AiAuditStatus.SUCCESS,
      latency,
      suggestedActionTypes,
    );

    return advice;
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private resolveProvider(mode: AiSuggestionsProviderMode): AiAdvisorProvider {
    switch (mode) {
      case AiSuggestionsProviderMode.REAL:
        return this.realProvider;
      case AiSuggestionsProviderMode.STUB:
      default:
        return this.stubProvider;
    }
  }

  private async getOrCreateDefaultPolicy(tenantId: string): Promise<AiSuggestionsPolicy> {
    let policy = await this.policyRepo.findOne({ where: { tenantId } });
    if (!policy) {
      try {
        // Create default policy (AI Suggestions OFF by default)
        policy = this.policyRepo.create({ tenantId });
        policy = await this.policyRepo.save(policy);
      } catch (error) {
        // Handle unique constraint race: another request created the policy concurrently
        policy = await this.policyRepo.findOne({ where: { tenantId } });
        if (!policy) {
          throw error; // Re-throw if it's a different error
        }
      }
    }
    return policy;
  }

  private async logAdviceEvent(
    tenantId: string,
    userId: string,
    notificationId: string,
    providerName: string,
    inputHash: string,
    status: AiAuditStatus,
    latencyMs: number,
    suggestedActionTypes: string[],
  ): Promise<void> {
    try {
      const event = this.auditRepo.create({
        tenantId,
        userId,
        featureKey: 'NOTIFICATION_AI_SUGGESTIONS',
        providerType: providerName,
        actionType: AiActionType.AI_ADVICE_GENERATED,
        status,
        latencyMs,
        requestHash: inputHash,
        details: JSON.stringify({
          notificationId,
          suggestedActionTypes,
        }),
      });
      await this.auditRepo.save(event);
    } catch (error) {
      this.logger.error('Failed to log AI advice audit event', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  // ── Activity Log Query ─────────────────────────────────────────────

  async queryActivityLog(
    tenantId: string,
    filters?: {
      userId?: string;
      status?: string;
      actionType?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<{ items: AiAuditEvent[]; total: number }> {
    const page = filters?.page || 1;
    const pageSize = Math.min(filters?.pageSize || 50, 200);

    const qb = this.auditRepo
      .createQueryBuilder('e')
      .where('e.tenantId = :tenantId', { tenantId })
      .andWhere('e.featureKey = :fk', { fk: 'NOTIFICATION_AI_SUGGESTIONS' });

    if (filters?.userId) {
      qb.andWhere('e.userId = :userId', { userId: filters.userId });
    }
    if (filters?.status) {
      qb.andWhere('e.status = :status', { status: filters.status });
    }
    if (filters?.actionType) {
      qb.andWhere('e.actionType = :actionType', { actionType: filters.actionType });
    }

    const total = await qb.getCount();
    qb.orderBy('e.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const items = await qb.getMany();
    return { items, total };
  }
}
