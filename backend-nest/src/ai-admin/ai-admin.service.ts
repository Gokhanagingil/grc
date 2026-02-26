import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AiProviderConfig,
  AiProviderType,
  AiFeaturePolicy,
  AiAuditEvent,
  AiActionType,
  AiAuditStatus,
} from './entities';
import { EncryptionService } from './encryption';
import { CreateProviderDto, UpdateProviderDto, UpsertPolicyDto } from './dto';

/**
 * Safe provider response — secrets stripped, boolean flags added
 */
export interface SafeProviderResponse {
  id: string;
  tenantId: string | null;
  providerType: AiProviderType;
  displayName: string;
  isEnabled: boolean;
  baseUrl: string | null;
  modelName: string | null;
  requestTimeoutMs: number;
  maxTokens: number | null;
  temperature: number | null;
  hasApiKey: boolean;
  hasCustomHeaders: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AiAdminService {
  private readonly logger = new Logger(AiAdminService.name);

  constructor(
    @InjectRepository(AiProviderConfig)
    private readonly providerRepo: Repository<AiProviderConfig>,
    @InjectRepository(AiFeaturePolicy)
    private readonly policyRepo: Repository<AiFeaturePolicy>,
    @InjectRepository(AiAuditEvent)
    private readonly auditRepo: Repository<AiAuditEvent>,
    private readonly encryptionService: EncryptionService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  // Provider Config CRUD
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Strip secrets from a provider config and return safe response
   */
  private toSafeProvider(config: AiProviderConfig): SafeProviderResponse {
    return {
      id: config.id,
      tenantId: config.tenantId,
      providerType: config.providerType,
      displayName: config.displayName,
      isEnabled: config.isEnabled,
      baseUrl: config.baseUrl,
      modelName: config.modelName,
      requestTimeoutMs: config.requestTimeoutMs,
      maxTokens: config.maxTokens,
      temperature:
        config.temperature !== null && config.temperature !== undefined
          ? Number(config.temperature)
          : null,
      hasApiKey: !!config.apiKeyEncrypted,
      hasCustomHeaders: !!config.customHeadersEncrypted,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * List all non-deleted provider configs visible to a tenant
   * (global configs + tenant-specific configs)
   */
  async listProviders(tenantId: string): Promise<SafeProviderResponse[]> {
    const configs = await this.providerRepo
      .createQueryBuilder('p')
      .where('p.is_deleted = false')
      .andWhere('(p.tenant_id = :tenantId OR p.tenant_id IS NULL)', {
        tenantId,
      })
      .orderBy('p.created_at', 'DESC')
      .getMany();

    return configs.map((c) => this.toSafeProvider(c));
  }

  /**
   * Get a single provider config by ID (tenant-scoped)
   */
  async getProvider(
    id: string,
    tenantId: string,
  ): Promise<SafeProviderResponse> {
    // Use query builder for proper NULL handling on tenant_id
    const result = await this.providerRepo
      .createQueryBuilder('p')
      .where('p.id = :id', { id })
      .andWhere('p.is_deleted = false')
      .andWhere('(p.tenant_id = :tenantId OR p.tenant_id IS NULL)', {
        tenantId,
      })
      .getOne();

    if (!result) {
      throw new NotFoundException(`Provider config ${id} not found`);
    }

    return this.toSafeProvider(result);
  }

  /**
   * Create a new provider config
   */
  async createProvider(
    tenantId: string,
    dto: CreateProviderDto,
  ): Promise<SafeProviderResponse> {
    const config = this.providerRepo.create({
      tenantId,
      providerType: dto.providerType,
      displayName: dto.displayName,
      isEnabled: dto.isEnabled ?? true,
      baseUrl: dto.baseUrl ?? null,
      modelName: dto.modelName ?? null,
      requestTimeoutMs: dto.requestTimeoutMs ?? 30000,
      maxTokens: dto.maxTokens ?? null,
      temperature: dto.temperature ?? null,
      apiKeyEncrypted: dto.apiKey
        ? this.encryptionService.encrypt(dto.apiKey)
        : null,
      customHeadersEncrypted: dto.customHeaders
        ? this.encryptionService.encrypt(dto.customHeaders)
        : null,
    });

    const saved = await this.providerRepo.save(config);
    return this.toSafeProvider(saved);
  }

  /**
   * Update an existing provider config
   */
  async updateProvider(
    id: string,
    tenantId: string,
    dto: UpdateProviderDto,
  ): Promise<SafeProviderResponse> {
    const existing = await this.providerRepo
      .createQueryBuilder('p')
      .where('p.id = :id', { id })
      .andWhere('p.is_deleted = false')
      .andWhere('(p.tenant_id = :tenantId OR p.tenant_id IS NULL)', {
        tenantId,
      })
      .getOne();

    if (!existing) {
      throw new NotFoundException(`Provider config ${id} not found`);
    }

    // Prevent tenant admins from modifying global (shared) provider configs
    if (existing.tenantId === null) {
      throw new ForbiddenException(
        'Global provider configs cannot be modified by tenant admins',
      );
    }

    // Update non-secret fields
    if (dto.providerType !== undefined)
      existing.providerType = dto.providerType;
    if (dto.displayName !== undefined) existing.displayName = dto.displayName;
    if (dto.isEnabled !== undefined) existing.isEnabled = dto.isEnabled;
    if (dto.baseUrl !== undefined) existing.baseUrl = dto.baseUrl;
    if (dto.modelName !== undefined) existing.modelName = dto.modelName;
    if (dto.requestTimeoutMs !== undefined)
      existing.requestTimeoutMs = dto.requestTimeoutMs;
    if (dto.maxTokens !== undefined) existing.maxTokens = dto.maxTokens;
    if (dto.temperature !== undefined) existing.temperature = dto.temperature;

    // Update secrets (only if provided — allows rotation)
    if (dto.apiKey !== undefined) {
      existing.apiKeyEncrypted = dto.apiKey
        ? this.encryptionService.encrypt(dto.apiKey)
        : null;
    }
    if (dto.customHeaders !== undefined) {
      existing.customHeadersEncrypted = dto.customHeaders
        ? this.encryptionService.encrypt(dto.customHeaders)
        : null;
    }

    const saved = await this.providerRepo.save(existing);
    return this.toSafeProvider(saved);
  }

  /**
   * Soft-delete a provider config
   */
  async deleteProvider(id: string, tenantId: string): Promise<void> {
    const existing = await this.providerRepo
      .createQueryBuilder('p')
      .where('p.id = :id', { id })
      .andWhere('p.is_deleted = false')
      .andWhere('(p.tenant_id = :tenantId OR p.tenant_id IS NULL)', {
        tenantId,
      })
      .getOne();

    if (!existing) {
      throw new NotFoundException(`Provider config ${id} not found`);
    }

    // Prevent tenant admins from deleting global (shared) provider configs
    if (existing.tenantId === null) {
      throw new ForbiddenException(
        'Global provider configs cannot be deleted by tenant admins',
      );
    }

    existing.isDeleted = true;
    existing.isEnabled = false;
    await this.providerRepo.save(existing);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Test Connection
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Test connection to a provider's health endpoint.
   * For LOCAL providers: GET {baseUrl}/health expecting 200 + { status: "ok" }.
   * Logs an AiAuditEvent with actionType=TEST_CONNECTION.
   */
  async testConnection(
    id: string,
    tenantId: string,
    userId: string | null,
  ): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const config = await this.providerRepo
      .createQueryBuilder('p')
      .where('p.id = :id', { id })
      .andWhere('p.is_deleted = false')
      .andWhere('(p.tenant_id = :tenantId OR p.tenant_id IS NULL)', {
        tenantId,
      })
      .getOne();

    if (!config) {
      throw new NotFoundException(`Provider config ${id} not found`);
    }

    const startTime = Date.now();
    let success = false;
    let message = '';

    try {
      if (config.providerType === AiProviderType.LOCAL) {
        if (!config.baseUrl) {
          throw new BadRequestException('Local provider requires a base URL');
        }

        const healthUrl = `${config.baseUrl.replace(/\/+$/, '')}/health`;

        // Build headers
        const headers: Record<string, string> = {
          Accept: 'application/json',
        };

        // Add auth token if encrypted key exists
        if (config.apiKeyEncrypted) {
          const apiKey = this.encryptionService.decrypt(config.apiKeyEncrypted);
          if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
          }
        }

        // Add custom headers if they exist
        if (config.customHeadersEncrypted) {
          const customHeadersJson = this.encryptionService.decrypt(
            config.customHeadersEncrypted,
          );
          if (customHeadersJson) {
            try {
              const customHeaders = JSON.parse(customHeadersJson) as Record<
                string,
                string
              >;
              for (const [key, value] of Object.entries(customHeaders)) {
                headers[key] = value;
              }
            } catch {
              // Invalid JSON — skip custom headers
            }
          }
        }

        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          config.requestTimeoutMs || 10000,
        );

        try {
          const response = await fetch(healthUrl, {
            method: 'GET',
            headers,
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (response.ok) {
            success = true;
            message = `Health check passed (HTTP ${response.status})`;
          } else {
            message = `Health check failed (HTTP ${response.status})`;
          }
        } catch (fetchError) {
          clearTimeout(timeout);
          const errorMessage =
            fetchError instanceof Error ? fetchError.message : 'Unknown error';
          message = `Connection failed: ${errorMessage}`;
        }
      } else {
        // For cloud providers in v1, just validate that required config exists
        if (
          config.providerType === AiProviderType.OPENAI ||
          config.providerType === AiProviderType.AZURE_OPENAI ||
          config.providerType === AiProviderType.ANTHROPIC
        ) {
          if (!config.apiKeyEncrypted) {
            message = 'API key not configured — cannot test connection';
          } else {
            // In v1, cloud providers are placeholders — mark as "config valid"
            success = true;
            message =
              'Configuration looks valid (cloud provider test deferred to v1.1)';
          }
        } else {
          success = true;
          message =
            'Provider configuration saved (test not applicable for this type)';
        }
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      message =
        error instanceof Error ? error.message : 'Unexpected error during test';
    }

    const latencyMs = Date.now() - startTime;

    // Log audit event
    await this.logAuditEvent({
      tenantId,
      userId,
      featureKey: 'SYSTEM',
      providerType: config.providerType,
      modelName: config.modelName ?? undefined,
      actionType: AiActionType.TEST_CONNECTION,
      status: success ? AiAuditStatus.SUCCESS : AiAuditStatus.FAIL,
      latencyMs,
      details: message,
    });

    return { success, latencyMs, message };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Feature Policy CRUD
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get the feature policy for a tenant (or null if none)
   */
  async getPolicy(tenantId: string): Promise<AiFeaturePolicy | null> {
    return this.policyRepo.findOne({ where: { tenantId } });
  }

  /**
   * Upsert (create or update) the feature policy for a tenant
   */
  async upsertPolicy(
    tenantId: string,
    dto: UpsertPolicyDto,
    userId: string | null,
  ): Promise<AiFeaturePolicy> {
    let policy = await this.policyRepo.findOne({ where: { tenantId } });

    if (policy) {
      policy.isAiEnabled = dto.isAiEnabled;
      if (dto.defaultProviderConfigId !== undefined) {
        policy.defaultProviderConfigId = dto.defaultProviderConfigId ?? null;
      }
      if (dto.humanApprovalRequiredDefault !== undefined) {
        policy.humanApprovalRequiredDefault = dto.humanApprovalRequiredDefault;
      }
      if (dto.allowedFeatures !== undefined) {
        policy.allowedFeatures = dto.allowedFeatures;
      }
    } else {
      policy = this.policyRepo.create({
        tenantId,
        isAiEnabled: dto.isAiEnabled,
        defaultProviderConfigId: dto.defaultProviderConfigId ?? null,
        humanApprovalRequiredDefault: dto.humanApprovalRequiredDefault ?? true,
        allowedFeatures: dto.allowedFeatures ?? {},
      });
    }

    const saved = await this.policyRepo.save(policy);

    // Log audit event
    await this.logAuditEvent({
      tenantId,
      userId,
      featureKey: 'SYSTEM',
      providerType: 'N/A',
      actionType: AiActionType.POLICY_CHANGE,
      status: AiAuditStatus.SUCCESS,
      details: `AI policy updated: enabled=${saved.isAiEnabled}`,
    });

    return saved;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Audit Log
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Query AI audit events with filtering and pagination
   */
  async queryAuditEvents(
    tenantId: string,
    options: {
      featureKey?: string;
      actionType?: string;
      status?: string;
      from?: string;
      to?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<{ items: AiAuditEvent[]; total: number }> {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const qb = this.auditRepo
      .createQueryBuilder('e')
      .where('e.tenant_id = :tenantId', { tenantId });

    if (options.featureKey) {
      qb.andWhere('e.feature_key = :featureKey', {
        featureKey: options.featureKey,
      });
    }
    if (options.actionType) {
      qb.andWhere('e.action_type = :actionType', {
        actionType: options.actionType,
      });
    }
    if (options.status) {
      qb.andWhere('e.status = :status', { status: options.status });
    }
    if (options.from) {
      qb.andWhere('e.created_at >= :from', { from: new Date(options.from) });
    }
    if (options.to) {
      qb.andWhere('e.created_at <= :to', { to: new Date(options.to) });
    }

    qb.orderBy('e.created_at', 'DESC').skip(skip).take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  /**
   * Log an AI audit event
   */
  async logAuditEvent(data: {
    tenantId: string;
    userId?: string | null;
    featureKey: string;
    providerType: string;
    modelName?: string;
    actionType: AiActionType;
    status: AiAuditStatus;
    latencyMs?: number;
    tokensIn?: number;
    tokensOut?: number;
    requestHash?: string;
    responseHash?: string;
    details?: string;
  }): Promise<AiAuditEvent> {
    const event = this.auditRepo.create({
      tenantId: data.tenantId,
      userId: data.userId ?? null,
      featureKey: data.featureKey,
      providerType: data.providerType,
      modelName: data.modelName ?? null,
      actionType: data.actionType,
      status: data.status,
      latencyMs: data.latencyMs ?? null,
      tokensIn: data.tokensIn ?? null,
      tokensOut: data.tokensOut ?? null,
      requestHash: data.requestHash ?? null,
      responseHash: data.responseHash ?? null,
      details: data.details ?? null,
    });

    return this.auditRepo.save(event);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Config Resolution (Phase 4 integration hook)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Resolve effective AI configuration for a tenant + feature.
   * Returns non-secret information suitable for consumption by
   * feature modules (Risk Advisory, Copilot, etc.).
   */
  async resolveEffectiveConfig(
    tenantId: string,
    featureKey: string,
  ): Promise<{
    isAiEnabled: boolean;
    isFeatureEnabled: boolean;
    providerType: AiProviderType | null;
    modelName: string | null;
    baseUrl: string | null;
    humanApprovalRequired: boolean;
  }> {
    const policy = await this.policyRepo.findOne({ where: { tenantId } });

    if (!policy || !policy.isAiEnabled) {
      return {
        isAiEnabled: false,
        isFeatureEnabled: false,
        providerType: null,
        modelName: null,
        baseUrl: null,
        humanApprovalRequired: true,
      };
    }

    const isFeatureEnabled = policy.allowedFeatures[featureKey] === true;

    // Resolve provider
    let provider: AiProviderConfig | null = null;

    if (policy.defaultProviderConfigId) {
      provider = await this.providerRepo
        .createQueryBuilder('p')
        .where('p.id = :id', { id: policy.defaultProviderConfigId })
        .andWhere('p.is_deleted = false')
        .andWhere('p.is_enabled = true')
        .andWhere('(p.tenant_id = :tenantId OR p.tenant_id IS NULL)', {
          tenantId,
        })
        .getOne();
    }

    // Fallback to any enabled global provider
    if (!provider) {
      provider = await this.providerRepo
        .createQueryBuilder('p')
        .where('p.tenant_id IS NULL')
        .andWhere('p.is_enabled = true')
        .andWhere('p.is_deleted = false')
        .orderBy('p.created_at', 'ASC')
        .getOne();
    }

    // Fallback to any enabled tenant-specific provider
    if (!provider) {
      provider = await this.providerRepo
        .createQueryBuilder('p')
        .where('p.tenant_id = :tenantId', { tenantId })
        .andWhere('p.is_enabled = true')
        .andWhere('p.is_deleted = false')
        .orderBy('p.created_at', 'ASC')
        .getOne();
    }

    return {
      isAiEnabled: true,
      isFeatureEnabled,
      providerType: provider?.providerType ?? null,
      modelName: provider?.modelName ?? null,
      baseUrl: provider?.baseUrl ?? null,
      humanApprovalRequired: policy.humanApprovalRequiredDefault,
    };
  }
}
