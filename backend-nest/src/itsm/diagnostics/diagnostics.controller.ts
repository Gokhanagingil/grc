import {
  Controller,
  Get,
  Post,
  UseGuards,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { Perf } from '../../common/decorators';
import { DiagnosticsService } from './diagnostics.service';

@Controller('grc/itsm/diagnostics')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class DiagnosticsController {
  constructor(private readonly diagnosticsService: DiagnosticsService) {}

  @Get('health')
  @Permissions(Permission.ITSM_STATISTICS_READ)
  @Perf()
  getHealth(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.diagnosticsService.getHealth(tenantId);
  }

  @Get('counts')
  @Permissions(Permission.ITSM_STATISTICS_READ)
  @Perf()
  async getCounts(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.diagnosticsService.getCounts(tenantId);
  }

  @Post('validate-baseline')
  @Permissions(Permission.ITSM_STATISTICS_READ)
  @Perf()
  async validateBaseline(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.diagnosticsService.validateBaseline(tenantId);
  }

  @Get('sla-summary')
  @Permissions(Permission.ITSM_SLA_READ)
  @Perf()
  async getSlaSummary(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.diagnosticsService.getActiveSlaInstanceSummary(tenantId);
  }
}
