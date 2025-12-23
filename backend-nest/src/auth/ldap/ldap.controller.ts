import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
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
import { LdapService } from './ldap.service';
import { UpdateLdapConfigDto, LdapGroupMappingDto } from './dto';
import { RequestWithUser } from '../../common/types';

/**
 * LDAP Controller
 *
 * Provides endpoints for LDAP/Active Directory configuration:
 * - Get/update LDAP configuration
 * - Test LDAP connection
 * - Manage group to role mappings
 */
@Controller('auth/ldap')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class LdapController {
  constructor(private readonly ldapService: LdapService) {}

  /**
   * Get LDAP status for current tenant
   */
  @Get('status')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async getLdapStatus(@NestRequest() req: RequestWithUser) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    const config = await this.ldapService.getLdapConfigSafe(tenantId);
    const enabled = await this.ldapService.isLdapEnabled(tenantId);

    return {
      enabled,
      configured: !!config,
      host: config?.host || null,
      port: config?.port || 389,
      useSsl: config?.useSsl || false,
      lastConnectionTest: config?.lastConnectionTest || null,
      lastConnectionStatus: config?.lastConnectionStatus || null,
    };
  }

  /**
   * Get full LDAP configuration (without sensitive data)
   */
  @Get('config')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async getLdapConfig(@NestRequest() req: RequestWithUser) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    return this.ldapService.getLdapConfigSafe(tenantId);
  }

  /**
   * Update LDAP configuration
   */
  @Post('config')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async updateLdapConfig(
    @NestRequest() req: RequestWithUser,
    @Body() dto: UpdateLdapConfigDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    await this.ldapService.saveLdapConfig(tenantId, dto);
    return this.ldapService.getLdapConfigSafe(tenantId);
  }

  /**
   * Test LDAP connection
   */
  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async testConnection(@NestRequest() req: RequestWithUser) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    return this.ldapService.testConnection(tenantId);
  }

  /**
   * Get group to role mappings
   */
  @Get('group-mappings')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async getGroupMappings(@NestRequest() req: RequestWithUser) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    return this.ldapService.getGroupMappings(tenantId);
  }

  /**
   * Create or update a group to role mapping
   */
  @Post('group-mappings')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async saveGroupMapping(
    @NestRequest() req: RequestWithUser,
    @Body() dto: LdapGroupMappingDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    return this.ldapService.saveGroupMapping(
      tenantId,
      dto.ldapGroupDn,
      dto.platformRole,
      dto.ldapGroupName,
      dto.priority,
    );
  }

  /**
   * Delete a group to role mapping
   */
  @Delete('group-mappings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async deleteGroupMapping(
    @NestRequest() req: RequestWithUser,
    @Param('id') mappingId: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID required');
    }

    await this.ldapService.deleteGroupMapping(tenantId, mappingId);
  }
}
