import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Headers,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../../auth/permissions/permissions.guard';
import { Permissions } from '../../../auth/permissions/permissions.decorator';
import { Permission } from '../../../auth/permissions/permission.enum';
import { Perf } from '../../../common/decorators';
import { ConflictDetectionService } from './conflict-detection.service';
import { ChangeService } from '../change.service';

@Controller('grc/itsm/changes')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ConflictController {
  constructor(
    private readonly conflictDetectionService: ConflictDetectionService,
    private readonly changeService: ChangeService,
  ) {}

  @Get(':id/conflicts')
  @Permissions(Permission.ITSM_CHANGE_READ)
  @Perf()
  async getConflicts(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.conflictDetectionService.getConflictsForChange(tenantId, id);
  }

  @Post(':id/refresh-conflicts')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async refreshConflicts(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const change = await this.changeService.findOneActiveForTenant(
      tenantId,
      id,
    );
    if (!change) {
      throw new BadRequestException(`Change ${id} not found`);
    }
    if (!change.plannedStartAt || !change.plannedEndAt) {
      return [];
    }

    return this.conflictDetectionService.refreshConflictsForChange(
      tenantId,
      req.user.id,
      id,
      change.plannedStartAt,
      change.plannedEndAt,
      change.serviceId || undefined,
    );
  }
}
