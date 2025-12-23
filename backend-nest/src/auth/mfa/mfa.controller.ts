import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request as NestRequest,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { Permissions } from '../permissions/permissions.decorator';
import { Permission } from '../permissions/permission.enum';
import { MfaService } from './mfa.service';
import {
  MfaVerifyDto,
  MfaEnforceDto,
  MfaResetDto,
  UpdateSecuritySettingsDto,
} from './dto';
import { RequestWithUser } from '../../common/types';

/**
 * MFA Controller
 *
 * Provides endpoints for Multi-Factor Authentication management:
 * - Setup and enable MFA for current user
 * - Verify MFA codes
 * - Admin endpoints for enforcement and reset
 * - Tenant security settings management
 */
@Controller('auth/mfa')
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  /**
   * Get MFA status for current user
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getMfaStatus(@NestRequest() req: RequestWithUser) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new BadRequestException('User not found');
    }

    return this.mfaService.getMfaStatus(userId);
  }

  /**
   * Generate MFA setup (secret and QR code)
   */
  @Post('setup')
  @UseGuards(JwtAuthGuard)
  async setupMfa(@NestRequest() req: RequestWithUser) {
    const userId = req.user?.sub;
    const email = req.user?.email;
    if (!userId || !email) {
      throw new BadRequestException('User not found');
    }

    // Check if MFA is already enabled
    const status = await this.mfaService.getMfaStatus(userId);
    if (status.enabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    // Generate secret
    const setup = this.mfaService.generateSecret(userId, email);

    // Store the secret (not yet enabled)
    await this.mfaService.setupMfa(userId, setup.secret);

    return setup;
  }

  /**
   * Verify MFA code and enable MFA
   * Returns recovery codes on success
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async verifyAndEnableMfa(
    @NestRequest() req: RequestWithUser,
    @Body() dto: MfaVerifyDto,
  ) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new BadRequestException('User not found');
    }

    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.mfaService.verifyAndEnableMfa(userId, dto.code, tenantId);
  }

  /**
   * Disable MFA for current user
   */
  @Post('disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async disableMfa(
    @NestRequest() req: RequestWithUser,
    @Body() dto: MfaVerifyDto,
  ) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new BadRequestException('User not found');
    }

    // Verify current MFA code before disabling
    const isValid = await this.mfaService.verifyMfaCode(userId, dto.code);
    if (!isValid) {
      throw new BadRequestException('Invalid MFA code');
    }

    const tenantId = req.tenantId ?? req.user?.tenantId;
    await this.mfaService.disableMfa(userId, userId, tenantId);

    return { success: true, message: 'MFA disabled successfully' };
  }

  /**
   * Regenerate recovery codes
   */
  @Post('recovery-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async regenerateRecoveryCodes(
    @NestRequest() req: RequestWithUser,
    @Body() dto: MfaVerifyDto,
  ) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new BadRequestException('User not found');
    }

    // Verify current MFA code before regenerating
    const isValid = await this.mfaService.verifyMfaCode(userId, dto.code);
    if (!isValid) {
      throw new BadRequestException('Invalid MFA code');
    }

    const recoveryCodes = await this.mfaService.regenerateRecoveryCodes(userId);
    return { recoveryCodes };
  }

  // ==================== Admin Endpoints ====================

  /**
   * Enforce MFA for a specific user (admin only)
   */
  @Post('admin/enforce')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(Permission.ADMIN_USERS_WRITE)
  async enforceMfa(
    @NestRequest() req: RequestWithUser,
    @Body() dto: MfaEnforceDto,
  ) {
    const adminId = req.user?.sub;
    if (!adminId) {
      throw new BadRequestException('Admin user not found');
    }

    const tenantId = req.tenantId;
    await this.mfaService.enforceMfa(dto.userId, adminId, tenantId);

    return { success: true, message: 'MFA enforcement enabled for user' };
  }

  /**
   * Reset MFA for a specific user (admin only)
   */
  @Post('admin/reset')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(Permission.ADMIN_USERS_WRITE)
  async resetMfa(
    @NestRequest() req: RequestWithUser,
    @Body() dto: MfaResetDto,
  ) {
    const adminId = req.user?.sub;
    if (!adminId) {
      throw new BadRequestException('Admin user not found');
    }

    const tenantId = req.tenantId;
    await this.mfaService.disableMfa(dto.userId, adminId, tenantId);

    return { success: true, message: 'MFA reset for user' };
  }

  /**
   * Get MFA status for a specific user (admin only)
   */
  @Get('admin/status/:userId')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(Permission.ADMIN_USERS_READ)
  async getAdminMfaStatus(@NestRequest() req: RequestWithUser) {
    const userId = req.params?.userId;
    if (!userId) {
      throw new BadRequestException('User ID required');
    }

    return this.mfaService.getMfaStatus(userId);
  }

  // ==================== Tenant Security Settings ====================

  /**
   * Get tenant security settings
   */
  @Get('settings')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async getSecuritySettings(@NestRequest() req: RequestWithUser) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    return this.mfaService.getTenantSecuritySettings(tenantId);
  }

  /**
   * Update tenant security settings
   */
  @Post('settings')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async updateSecuritySettings(
    @NestRequest() req: RequestWithUser,
    @Body() dto: UpdateSecuritySettingsDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    return this.mfaService.updateTenantSecuritySettings(tenantId, dto);
  }
}
