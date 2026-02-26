import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Body,
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
import { ToolGatewayService } from './tool-gateway.service';
import {
  CreateIntegrationProviderDto,
  UpdateIntegrationProviderDto,
  UpsertToolPolicyDto,
  RunToolDto,
} from './dto';

/**
 * Tool Gateway Controller
 *
 * Admin endpoints for managing external tool integrations (ServiceNow etc.):
 * - Integration provider config CRUD
 * - Tool policy management
 * - Connection testing
 *
 * Runtime endpoints:
 * - POST /tools/run — execute a governed tool
 * - GET /tools/status — check tool availability
 *
 * All endpoints require authentication + tenant isolation.
 * Admin endpoints require ADMIN_SETTINGS_READ/WRITE permissions.
 */
@Controller('grc/admin/tools')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ToolGatewayAdminController {
  constructor(private readonly toolGatewayService: ToolGatewayService) {}

  // ═══════════════════════════════════════════════════════════════════════
  // Integration Provider Config CRUD
  // ═══════════════════════════════════════════════════════════════════════

  @Get('providers')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async listProviders(@NestRequest() req: RequestWithUser) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    const items = await this.toolGatewayService.listProviders(tenantId);
    return { items };
  }

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
    return this.toolGatewayService.getProvider(id, tenantId);
  }

  @Post('providers')
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async createProvider(
    @Body() dto: CreateIntegrationProviderDto,
    @NestRequest() req: RequestWithUser,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.toolGatewayService.createProvider(tenantId, dto);
  }

  @Patch('providers/:id')
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async updateProvider(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIntegrationProviderDto,
    @NestRequest() req: RequestWithUser,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.toolGatewayService.updateProvider(id, tenantId, dto);
  }

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
    await this.toolGatewayService.deleteProvider(id, tenantId);
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Test Connection
  // ═══════════════════════════════════════════════════════════════════════

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
    return this.toolGatewayService.testConnection(id, tenantId, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Tool Policy
  // ═══════════════════════════════════════════════════════════════════════

  @Get('policies')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async getPolicy(@NestRequest() req: RequestWithUser) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    const policy = await this.toolGatewayService.getPolicy(tenantId);
    return (
      policy ?? {
        isToolsEnabled: false,
        allowedTools: [],
        rateLimitPerMinute: 60,
        maxToolCallsPerRun: 10,
      }
    );
  }

  @Put('policies/:tenantId')
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async upsertPolicy(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: UpsertToolPolicyDto,
    @NestRequest() req: RequestWithUser,
  ) {
    if (req.tenantId !== tenantId) {
      throw new BadRequestException(
        'Tenant ID in URL must match request tenant context',
      );
    }
    const userId = req.user?.sub ?? null;
    return this.toolGatewayService.upsertPolicy(tenantId, dto, userId);
  }
}

/**
 * Tool Gateway Runtime Controller
 *
 * Runtime endpoints for executing governed tools and checking status.
 * These are used by platform features (not just admin).
 */
@Controller('grc/tools')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ToolGatewayRuntimeController {
  constructor(private readonly toolGatewayService: ToolGatewayService) {}

  /**
   * Execute a governed tool
   */
  @Post('run')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async runTool(@Body() dto: RunToolDto, @NestRequest() req: RequestWithUser) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    const userId = req.user?.sub ?? null;
    return this.toolGatewayService.runTool(tenantId, userId, dto);
  }

  /**
   * Get tool availability status for the current tenant
   */
  @Get('status')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async getToolStatus(@NestRequest() req: RequestWithUser) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }
    return this.toolGatewayService.getToolStatus(tenantId);
  }
}
