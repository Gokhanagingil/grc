import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';

/**
 * Settings Controller
 *
 * Provides endpoints for reading system and tenant settings.
 * All endpoints require authentication and ADMIN role.
 */
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Get the effective setting value for a key
   *
   * If x-tenant-id header is provided, checks for tenant-specific override first.
   * Falls back to system setting if no tenant override exists.
   *
   * @param key - The setting key to retrieve
   * @returns The effective setting value
   */
  @Get('effective')
  @Roles(UserRole.ADMIN)
  async getEffectiveSetting(
    @Query('key') key: string,
    @Req() request: Request,
  ): Promise<{ key: string; value: string | null; source: string }> {
    if (!key) {
      throw new BadRequestException('Query parameter "key" is required');
    }

    const tenantId = request.headers['x-tenant-id'] as string | undefined;

    // Check tenant setting first if tenantId is provided
    if (tenantId) {
      const tenantValue = await this.settingsService.getTenantSetting(
        tenantId,
        key,
      );
      if (tenantValue !== null) {
        return { key, value: tenantValue, source: 'tenant' };
      }
    }

    // Fall back to system setting
    const systemValue = await this.settingsService.getSystemSetting(key);
    if (systemValue !== null) {
      return { key, value: systemValue, source: 'system' };
    }

    return { key, value: null, source: 'none' };
  }

  /**
   * Get all system settings
   *
   * @returns List of all system settings
   */
  @Get('system')
  @Roles(UserRole.ADMIN)
  async getAllSystemSettings(): Promise<{
    settings: Array<{
      key: string;
      value: string;
      description: string | null;
      category: string | null;
    }>;
  }> {
    const settings = await this.settingsService.getAllSystemSettings();
    return {
      settings: settings.map((s) => ({
        key: s.key,
        value: s.value,
        description: s.description,
        category: s.category,
      })),
    };
  }

  /**
   * Get all tenant settings for the current tenant
   *
   * Requires x-tenant-id header.
   *
   * @returns List of tenant-specific settings
   */
  @Get('tenant')
  @Roles(UserRole.ADMIN)
  async getAllTenantSettings(
    @Req() request: Request,
  ): Promise<{ settings: Array<{ key: string; value: string }> }> {
    const tenantId = request.headers['x-tenant-id'] as string | undefined;

    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const settings = await this.settingsService.getAllTenantSettings(tenantId);
    return {
      settings: settings.map((s) => ({
        key: s.key,
        value: s.value,
      })),
    };
  }

  /**
   * Get system information for admin panel
   *
   * Returns backend version, environment info, and configuration details.
   *
   * @returns System information object
   */
  @Get('system-info')
  @Roles(UserRole.ADMIN)
  async getSystemInfo(@Req() request: Request): Promise<{
    backendVersion: string;
    frontendVersion: string;
    apiGatewayStatus: string;
    jwtExpiry: string;
    activeTenant: string | null;
    logLevel: string;
    storageProvider: string;
    nodeEnv: string;
    uptime: number;
  }> {
    const tenantId = request.headers['x-tenant-id'] as string | undefined;

    return {
      backendVersion: process.env.npm_package_version || '1.0.0',
      frontendVersion: '1.0.0',
      apiGatewayStatus: 'healthy',
      jwtExpiry: process.env.JWT_EXPIRY || '24h',
      activeTenant: tenantId || null,
      logLevel: process.env.LOG_LEVEL || 'info',
      storageProvider: process.env.STORAGE_PROVIDER || 'local',
      nodeEnv: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
    };
  }
}
