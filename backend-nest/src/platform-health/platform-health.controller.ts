import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { Permissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permission.enum';
import { PlatformHealthService } from './platform-health.service';
import { IngestRunDto } from './platform-health.dto';

@Controller('grc/platform-health')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class PlatformHealthController {
  constructor(private readonly platformHealthService: PlatformHealthService) {}

  @Get('runs')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async listRuns(
    @Query('limit') limit?: string,
    @Query('suite') suite?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 20, 100) : 20;
    return this.platformHealthService.listRuns(parsedLimit, suite, tenantId);
  }

  @Get('runs/:id')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async getRunDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const run = await this.platformHealthService.getRunWithChecks(id, tenantId);
    if (!run) {
      throw new NotFoundException('Platform health run not found');
    }
    return run;
  }

  @Get('badge')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async getBadge(
    @Query('suite') suite?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.platformHealthService.getBadge(suite || 'TIER1', tenantId);
  }

  @Post('ingest')
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async ingest(@Body() dto: IngestRunDto) {
    return this.platformHealthService.ingest(dto);
  }
}
