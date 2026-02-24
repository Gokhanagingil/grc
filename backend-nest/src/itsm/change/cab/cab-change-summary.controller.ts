import {
  Controller,
  Get,
  Param,
  UseGuards,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../../auth/permissions/permissions.guard';
import { Permissions } from '../../../auth/permissions/permissions.decorator';
import { Permission } from '../../../auth/permissions/permission.enum';
import { Perf } from '../../../common/decorators';
import { CabMeetingService } from './cab-meeting.service';

@Controller('grc/itsm/changes')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CabChangeSummaryController {
  constructor(private readonly cabMeetingService: CabMeetingService) {}

  @Get(':id/cab-summary')
  @Permissions(Permission.ITSM_CHANGE_READ)
  @Perf()
  async getCabSummary(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.cabMeetingService.getCabSummaryForChange(tenantId, id);
  }
}
