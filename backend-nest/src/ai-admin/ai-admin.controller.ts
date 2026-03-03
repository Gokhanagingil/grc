import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request as NestRequest,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { Permissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permission.enum';
import { RequestWithUser } from '../common/types';
import { AiAdminService } from './ai-admin.service';
import { AiSuggestionsService } from './ai-suggestions.service';
import {
  CreateProviderDto,
  UpdateProviderDto,
  UpsertPolicyDto,
  QueryAuditDto,
  UpsertAiSuggestionsPolicyDto,
  QueryAiActivityLogDto,
} from './dto';

/**
 * AI Admin Controller
 *
 * Admin-only endpoints for AI Control Center:
 * - Provider configuration CRUD
 * - Feature policy management
 * - Connection testing
 * - Audit log queries
 *
 * All endpoints require ADMIN_SETTINGS_READ or ADMIN_SETTINGS_WRITE permissions.
 * Tenant isolation is enforced via TenantGuard + x-tenant-id header.
 */
@Controller('grc/admin/ai')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class AiAdminController {
  constructor(
    private readonly aiAdminService: AiAdminService,
    private readonly aiSuggestionsService: AiSuggestionsService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  // Provider Config CRUD
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * List all provider configs visible to the tenant (global + tenant-specific)
   */
  @Get('providers')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async listProviders(@NestRequest() req: RequestWithUser) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    const items = await this.aiAdminService.listProviders(tenantId);
    return { items };
  }

  /**
   * Get a single provider config (secrets excluded)
   */
  @Get('providers/:id')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async getProvider(
    @Param('id', ParseUUIDPipe) id: string,
    @NestRequest() req: RequestWithUser,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.aiAdminService.getProvider(id, tenantId);
  }

  /**
   * Create a new provider config
   */
  @Post('providers')
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async createProvider(
    @Body() dto: CreateProviderDto,
    @NestRequest() req: RequestWithUser,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.aiAdminService.createProvider(tenantId, dto);
  }

  /**
   * Update an existing provider config (supports secret rotation)
   */
  @Patch('providers/:id')
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async updateProvider(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProviderDto,
    @NestRequest() req: RequestWithUser,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.aiAdminService.updateProvider(id, tenantId, dto);
  }

  /**
   * Soft-delete a provider config
   */
  @Delete('providers/:id')
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async deleteProvider(
    @Param('id', ParseUUIDPipe) id: string,
    @NestRequest() req: RequestWithUser,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    await this.aiAdminService.deleteProvider(id, tenantId);
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Test Connection
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Test connection to a provider's health endpoint
   */
  @Post('providers/:id/test')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async testConnection(
    @Param('id', ParseUUIDPipe) id: string,
    @NestRequest() req: RequestWithUser,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    const userId = req.user?.sub ?? null;
    return this.aiAdminService.testConnection(id, tenantId, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Feature Policy
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get the AI feature policy for the current tenant
   */
  @Get('policies')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async getPolicy(@NestRequest() req: RequestWithUser) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    const policy = await this.aiAdminService.getPolicy(tenantId);
    return policy ?? { isAiEnabled: false, allowedFeatures: {} };
  }

  /**
   * Upsert the AI feature policy for a specific tenant
   */
  @Put('policies/:tenantId')
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async upsertPolicy(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: UpsertPolicyDto,
    @NestRequest() req: RequestWithUser,
  ) {
    // Ensure the request tenant matches the target tenant
    if (req.tenantId !== tenantId) {
      throw new BadRequestException(
        'Tenant ID in URL must match request tenant context',
      );
    }
    const userId = req.user?.sub ?? null;
    return this.aiAdminService.upsertPolicy(tenantId, dto, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Audit Log
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Query AI audit events (paginated, filtered)
   */
  @Get('audit')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async queryAudit(
    @Query() query: QueryAuditDto,
    @NestRequest() req: RequestWithUser,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.aiAdminService.queryAuditEvents(tenantId, {
      featureKey: query.featureKey,
      actionType: query.actionType,
      status: query.status,
      from: query.from,
      to: query.to,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Config Resolution (Phase 4 integration hook)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Resolve effective AI config for a tenant + feature.
   * Used by feature modules to check if AI is enabled.
   */
  @Get('config/resolve')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async resolveConfig(
    @Query('featureKey') featureKey: string,
    @NestRequest() req: RequestWithUser,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    if (!featureKey) {
      throw new BadRequestException('featureKey query parameter required');
    }
    return this.aiAdminService.resolveEffectiveConfig(tenantId, featureKey);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // AI Suggestions Governance (v0)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get AI Suggestions policy for the current tenant
   */
  @Get('suggestions/policy')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async getSuggestionsPolicy(@NestRequest() req: RequestWithUser) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    const policy = await this.aiSuggestionsService.getPolicy(tenantId);
    return policy ?? {
      aiSuggestionsEnabled: false,
      providerMode: 'STUB',
      allowedActionTypes: ['OPEN_ENTITY', 'MARK_READ', 'ASSIGN_TO_ME', 'SET_DUE_DATE', 'CREATE_FOLLOWUP_TODO'],
      allowedInputFields: ['notification.type', 'notification.severity', 'notification.dueAt', 'notification.entityType', 'snapshot.primaryLabel', 'snapshot.secondaryLabel', 'snapshot.keyFields'],
      requiresConfirm: true,
      rateLimitPerUserPerMinute: 3,
      rateLimitPerTenantPerDay: 0,
      cacheTtlSeconds: 600,
    };
  }

  /**
   * Upsert AI Suggestions policy for the current tenant
   */
  @Put('suggestions/policy')
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async upsertSuggestionsPolicy(
    @Body() dto: UpsertAiSuggestionsPolicyDto,
    @NestRequest() req: RequestWithUser,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.aiSuggestionsService.upsertPolicy(tenantId, dto);
  }

  /**
   * Query AI Suggestions activity log (admin view)
   */
  @Get('suggestions/activity')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async querySuggestionsActivity(
    @Query() query: QueryAiActivityLogDto,
    @NestRequest() req: RequestWithUser,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.aiSuggestionsService.queryActivityLog(tenantId, {
      userId: query.userId,
      status: query.status,
      actionType: query.actionType,
      page: query.page,
      pageSize: query.pageSize,
    });
  }
}
