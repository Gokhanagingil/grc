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
  IntegrationProviderConfig,
  IntegrationProviderKey,
  ToolPolicy,
  ToolKey,
} from './entities';
import {
  AiAuditEvent,
  AiActionType,
  AiAuditStatus,
} from '../ai-admin/entities';
import { EncryptionService } from '../ai-admin/encryption';
import { SsrfGuardService } from '../notification-engine/services/ssrf-guard.service';
import {
  CreateIntegrationProviderDto,
  UpdateIntegrationProviderDto,
  UpsertToolPolicyDto,
  RunToolDto,
} from './dto';
import {
  ServiceNowToolProvider,
  ToolRunResult,
} from './providers/servicenow-tool.provider';

/**
 * Safe provider response — secrets stripped, boolean flags added
 */
export interface SafeIntegrationProviderResponse {
  id: string;
  tenantId: string;
  providerKey: IntegrationProviderKey;
  displayName: string;
  isEnabled: boolean;
  baseUrl: string;
  authType: string;
  hasUsername: boolean;
  hasPassword: boolean;
  hasToken: boolean;
  hasCustomHeaders: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * All valid tool keys for validation
 */
const VALID_TOOL_KEYS = new Set<string>(Object.values(ToolKey));

@Injectable()
export class ToolGatewayService {
  private readonly logger = new Logger(ToolGatewayService.name);
  private readonly snToolProvider: ServiceNowToolProvider;

  constructor(
    @InjectRepository(IntegrationProviderConfig)
    private readonly providerRepo: Repository<IntegrationProviderConfig>,
    @InjectRepository(ToolPolicy)
    private readonly policyRepo: Repository<ToolPolicy>,
    @InjectRepository(AiAuditEvent)
    private readonly auditRepo: Repository<AiAuditEvent>,
    private readonly encryptionService: EncryptionService,
    private readonly ssrfGuardService: SsrfGuardService,
  ) {
    this.snToolProvider = new ServiceNowToolProvider(encryptionService);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Provider Config CRUD
  // ═══════════════════════════════════════════════════════════════════════

  private toSafeProvider(
    config: IntegrationProviderConfig,
  ): SafeIntegrationProviderResponse {
    return {
      id: config.id,
      tenantId: config.tenantId,
      providerKey: config.providerKey,
      displayName: config.displayName,
      isEnabled: config.isEnabled,
      baseUrl: config.baseUrl,
      authType: config.authType,
      hasUsername: !!config.usernameEncrypted,
      hasPassword: !!config.passwordEncrypted,
      hasToken: !!config.tokenEncrypted,
      hasCustomHeaders: !!config.customHeadersEncrypted,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  async listProviders(
    tenantId: string,
  ): Promise<SafeIntegrationProviderResponse[]> {
    const configs = await this.providerRepo
      .createQueryBuilder('p')
      .where('p.is_deleted = false')
      .andWhere('p.tenant_id = :tenantId', { tenantId })
      .orderBy('p.created_at', 'DESC')
      .getMany();

    return configs.map((c) => this.toSafeProvider(c));
  }

  async getProvider(
    id: string,
    tenantId: string,
  ): Promise<SafeIntegrationProviderResponse> {
    const result = await this.providerRepo
      .createQueryBuilder('p')
      .where('p.id = :id', { id })
      .andWhere('p.is_deleted = false')
      .andWhere('p.tenant_id = :tenantId', { tenantId })
      .getOne();

    if (!result) {
      throw new NotFoundException(
        `Integration provider config ${id} not found`,
      );
    }

    return this.toSafeProvider(result);
  }

  async createProvider(
    tenantId: string,
    dto: CreateIntegrationProviderDto,
  ): Promise<SafeIntegrationProviderResponse> {
    // Validate base URL for SSRF
    const ssrfResult = this.ssrfGuardService.validateUrl(dto.baseUrl);
    if (!ssrfResult.valid) {
      throw new BadRequestException(
        `Base URL failed SSRF validation: ${ssrfResult.reason}`,
      );
    }

    const config = this.providerRepo.create({
      tenantId,
      providerKey: dto.providerKey,
      displayName: dto.displayName,
      isEnabled: dto.isEnabled ?? true,
      baseUrl: dto.baseUrl,
      authType: dto.authType,
      usernameEncrypted: dto.username
        ? this.encryptionService.encrypt(dto.username)
        : null,
      passwordEncrypted: dto.password
        ? this.encryptionService.encrypt(dto.password)
        : null,
      tokenEncrypted: dto.token
        ? this.encryptionService.encrypt(dto.token)
        : null,
      customHeadersEncrypted: dto.customHeaders
        ? this.encryptionService.encrypt(dto.customHeaders)
        : null,
    });

    const saved = await this.providerRepo.save(config);
    return this.toSafeProvider(saved);
  }

  async updateProvider(
    id: string,
    tenantId: string,
    dto: UpdateIntegrationProviderDto,
  ): Promise<SafeIntegrationProviderResponse> {
    const existing = await this.providerRepo
      .createQueryBuilder('p')
      .where('p.id = :id', { id })
      .andWhere('p.is_deleted = false')
      .andWhere('p.tenant_id = :tenantId', { tenantId })
      .getOne();

    if (!existing) {
      throw new NotFoundException(
        `Integration provider config ${id} not found`,
      );
    }

    // Validate base URL if being updated
    if (dto.baseUrl !== undefined) {
      const ssrfResult = this.ssrfGuardService.validateUrl(dto.baseUrl);
      if (!ssrfResult.valid) {
        throw new BadRequestException(
          `Base URL failed SSRF validation: ${ssrfResult.reason}`,
        );
      }
      existing.baseUrl = dto.baseUrl;
    }

    if (dto.providerKey !== undefined) existing.providerKey = dto.providerKey;
    if (dto.displayName !== undefined) existing.displayName = dto.displayName;
    if (dto.isEnabled !== undefined) existing.isEnabled = dto.isEnabled;
    if (dto.authType !== undefined) existing.authType = dto.authType;

    // Update secrets (only if provided — allows rotation)
    if (dto.username !== undefined) {
      existing.usernameEncrypted = dto.username
        ? this.encryptionService.encrypt(dto.username)
        : null;
    }
    if (dto.password !== undefined) {
      existing.passwordEncrypted = dto.password
        ? this.encryptionService.encrypt(dto.password)
        : null;
    }
    if (dto.token !== undefined) {
      existing.tokenEncrypted = dto.token
        ? this.encryptionService.encrypt(dto.token)
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

  async deleteProvider(id: string, tenantId: string): Promise<void> {
    const existing = await this.providerRepo
      .createQueryBuilder('p')
      .where('p.id = :id', { id })
      .andWhere('p.is_deleted = false')
      .andWhere('p.tenant_id = :tenantId', { tenantId })
      .getOne();

    if (!existing) {
      throw new NotFoundException(
        `Integration provider config ${id} not found`,
      );
    }

    existing.isDeleted = true;
    existing.isEnabled = false;
    await this.providerRepo.save(existing);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Test Connection
  // ═══════════════════════════════════════════════════════════════════════

  async testConnection(
    id: string,
    tenantId: string,
    userId: string | null,
  ): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const config = await this.providerRepo
      .createQueryBuilder('p')
      .where('p.id = :id', { id })
      .andWhere('p.is_deleted = false')
      .andWhere('p.tenant_id = :tenantId', { tenantId })
      .getOne();

    if (!config) {
      throw new NotFoundException(
        `Integration provider config ${id} not found`,
      );
    }

    // SSRF validation on base URL
    const ssrfResult = this.ssrfGuardService.validateUrl(config.baseUrl);
    if (!ssrfResult.valid) {
      const result = {
        success: false,
        latencyMs: 0,
        message: `Base URL failed SSRF validation: ${ssrfResult.reason}`,
      };
      await this.logToolAuditEvent({
        tenantId,
        userId,
        toolKey: 'TEST_CONNECTION',
        providerKey: config.providerKey,
        actionType: AiActionType.TOOL_TEST_CONNECTION,
        status: AiAuditStatus.FAIL,
        latencyMs: 0,
        details: result.message,
      });
      return result;
    }

    const result = await this.snToolProvider.testConnection(config);

    await this.logToolAuditEvent({
      tenantId,
      userId,
      toolKey: 'TEST_CONNECTION',
      providerKey: config.providerKey,
      actionType: AiActionType.TOOL_TEST_CONNECTION,
      status: result.success ? AiAuditStatus.SUCCESS : AiAuditStatus.FAIL,
      latencyMs: result.latencyMs,
      details: result.message,
    });

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Tool Policy CRUD
  // ═══════════════════════════════════════════════════════════════════════

  async getPolicy(tenantId: string): Promise<ToolPolicy | null> {
    return this.policyRepo.findOne({ where: { tenantId } });
  }

  async upsertPolicy(
    tenantId: string,
    dto: UpsertToolPolicyDto,
    userId: string | null,
  ): Promise<ToolPolicy> {
    // Validate allowedTools against known tool keys
    if (dto.allowedTools) {
      const invalid = dto.allowedTools.filter((t) => !VALID_TOOL_KEYS.has(t));
      if (invalid.length > 0) {
        throw new BadRequestException(
          `Invalid tool keys: ${invalid.join(', ')}. Valid keys: ${[...VALID_TOOL_KEYS].join(', ')}`,
        );
      }
    }

    let policy = await this.policyRepo.findOne({ where: { tenantId } });

    if (policy) {
      policy.isToolsEnabled = dto.isToolsEnabled;
      if (dto.allowedTools !== undefined) {
        policy.allowedTools = dto.allowedTools;
      }
      if (dto.rateLimitPerMinute !== undefined) {
        policy.rateLimitPerMinute = dto.rateLimitPerMinute;
      }
      if (dto.maxToolCallsPerRun !== undefined) {
        policy.maxToolCallsPerRun = dto.maxToolCallsPerRun;
      }
    } else {
      policy = this.policyRepo.create({
        tenantId,
        isToolsEnabled: dto.isToolsEnabled,
        allowedTools: dto.allowedTools ?? [],
        rateLimitPerMinute: dto.rateLimitPerMinute ?? 60,
        maxToolCallsPerRun: dto.maxToolCallsPerRun ?? 10,
      });
    }

    const saved = await this.policyRepo.save(policy);

    await this.logToolAuditEvent({
      tenantId,
      userId,
      toolKey: 'SYSTEM',
      providerKey: 'SYSTEM',
      actionType: AiActionType.POLICY_CHANGE,
      status: AiAuditStatus.SUCCESS,
      details: `Tool policy updated: enabled=${saved.isToolsEnabled}, tools=${saved.allowedTools.join(',')}`,
    });

    return saved;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Runtime: Tool Execution
  // ═══════════════════════════════════════════════════════════════════════

  async runTool(
    tenantId: string,
    userId: string | null,
    dto: RunToolDto,
  ): Promise<ToolRunResult> {
    const startTime = Date.now();

    // 1. Validate tool key
    if (!VALID_TOOL_KEYS.has(dto.toolKey)) {
      return {
        success: false,
        data: null,
        meta: {},
        error: `Unknown tool key: ${dto.toolKey}. Valid keys: ${[...VALID_TOOL_KEYS].join(', ')}`,
      };
    }

    // 2. Check tool policy
    const policy = await this.policyRepo.findOne({ where: { tenantId } });
    if (!policy || !policy.isToolsEnabled) {
      await this.logToolAuditEvent({
        tenantId,
        userId,
        toolKey: dto.toolKey,
        actionType: AiActionType.TOOL_RUN,
        status: AiAuditStatus.FAIL,
        latencyMs: Date.now() - startTime,
        details: 'Tools are disabled for this tenant',
      });
      throw new ForbiddenException('Tools are disabled for this tenant');
    }

    if (!policy.allowedTools.includes(dto.toolKey)) {
      await this.logToolAuditEvent({
        tenantId,
        userId,
        toolKey: dto.toolKey,
        actionType: AiActionType.TOOL_RUN,
        status: AiAuditStatus.FAIL,
        latencyMs: Date.now() - startTime,
        details: `Tool "${dto.toolKey}" is not in the allowlist`,
      });
      throw new ForbiddenException(
        `Tool "${dto.toolKey}" is not allowed by tenant policy`,
      );
    }

    // 3. Find active ServiceNow provider for this tenant
    const providerConfig = await this.providerRepo
      .createQueryBuilder('p')
      .where('p.is_deleted = false')
      .andWhere('p.is_enabled = true')
      .andWhere('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.provider_key = :providerKey', {
        providerKey: IntegrationProviderKey.SERVICENOW,
      })
      .getOne();

    if (!providerConfig) {
      await this.logToolAuditEvent({
        tenantId,
        userId,
        toolKey: dto.toolKey,
        actionType: AiActionType.TOOL_RUN,
        status: AiAuditStatus.FAIL,
        latencyMs: Date.now() - startTime,
        details: 'No active ServiceNow provider configured',
      });
      throw new NotFoundException(
        'No active ServiceNow provider configured for this tenant',
      );
    }

    // 4. Execute tool
    const result = await this.snToolProvider.execute(
      dto.toolKey,
      dto.input,
      providerConfig,
    );

    const latencyMs = Date.now() - startTime;

    // 5. Audit log
    await this.logToolAuditEvent({
      tenantId,
      userId,
      toolKey: dto.toolKey,
      providerKey: providerConfig.providerKey,
      actionType: AiActionType.TOOL_RUN,
      status: result.success ? AiAuditStatus.SUCCESS : AiAuditStatus.FAIL,
      latencyMs,
      details: result.error || 'OK',
      requestMeta: {
        table: result.meta.table,
        recordCount: result.meta.recordCount,
        totalCount: result.meta.totalCount,
      },
    });

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Tool Status (for features / UI)
  // ═══════════════════════════════════════════════════════════════════════

  async getToolStatus(tenantId: string): Promise<{
    isToolsEnabled: boolean;
    availableTools: string[];
    hasServiceNowProvider: boolean;
  }> {
    const policy = await this.policyRepo.findOne({ where: { tenantId } });

    const hasSnProvider = await this.providerRepo
      .createQueryBuilder('p')
      .where('p.is_deleted = false')
      .andWhere('p.is_enabled = true')
      .andWhere('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.provider_key = :providerKey', {
        providerKey: IntegrationProviderKey.SERVICENOW,
      })
      .getCount()
      .then((count) => count > 0);

    return {
      isToolsEnabled: policy?.isToolsEnabled ?? false,
      availableTools: policy?.allowedTools ?? [],
      hasServiceNowProvider: hasSnProvider,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Audit Logging
  // ═══════════════════════════════════════════════════════════════════════

  private async logToolAuditEvent(data: {
    tenantId: string;
    userId?: string | null;
    toolKey: string;
    providerKey?: string;
    actionType: AiActionType;
    status: AiAuditStatus;
    latencyMs?: number;
    details?: string;
    requestMeta?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const event = this.auditRepo.create({
        tenantId: data.tenantId,
        userId: data.userId ?? null,
        featureKey: 'TOOL_GATEWAY',
        providerType: data.providerKey ?? 'N/A',
        actionType: data.actionType,
        status: data.status,
        latencyMs: data.latencyMs ?? null,
        details: data.details ?? null,
        toolKey: data.toolKey,
        providerKey: data.providerKey ?? null,
        requestMeta: data.requestMeta ?? null,
      });
      await this.auditRepo.save(event);
    } catch (err) {
      this.logger.error('Failed to log tool audit event', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
