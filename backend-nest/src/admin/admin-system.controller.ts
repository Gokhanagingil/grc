import {
  Controller,
  Get,
  UseGuards,
  Request as NestRequest,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { Permissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permission.enum';
import { AdminSystemService } from './admin-system.service';
import { RequestWithUser } from '../common/types';

/**
 * Admin System Controller
 *
 * Provides endpoints for admin system visibility:
 * - Security posture
 * - Authentication modes
 * - System health indicators
 */
@Controller('admin/system')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class AdminSystemController {
  constructor(private readonly adminSystemService: AdminSystemService) {}

  /**
   * Get security posture for current tenant
   */
  @Get('security-posture')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async getSecurityPosture(@NestRequest() req: RequestWithUser) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    return this.adminSystemService.getSecurityPosture(tenantId);
  }

  /**
   * Get authentication modes summary for current tenant
   */
  @Get('auth-modes')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async getAuthModes(@NestRequest() req: RequestWithUser) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    return this.adminSystemService.getAuthModesSummary(tenantId);
  }
}
