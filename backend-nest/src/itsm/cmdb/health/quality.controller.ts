import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Headers,
  Request,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../../auth/permissions/permissions.guard';
import { Permissions } from '../../../auth/permissions/permissions.decorator';
import { Permission } from '../../../auth/permissions/permission.enum';
import { Perf } from '../../../common/decorators';
import { QualitySnapshotService } from './quality-snapshot.service';
import { HealthEvaluationService } from './health-evaluation.service';

@Controller('grc/cmdb/quality')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class QualityController {
  constructor(
    private readonly snapshotService: QualitySnapshotService,
    private readonly evaluationService: HealthEvaluationService,
  ) {}

  @Get()
  @Permissions(Permission.CMDB_HEALTH_READ)
  @Perf()
  async getLatest(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const snapshot = await this.snapshotService.getLatest(tenantId);
    return (
      snapshot ?? {
        score: 0,
        totalCis: 0,
        openFindings: 0,
        breakdown: { bySeverity: {}, byRule: [] },
      }
    );
  }

  @Get('history')
  @Permissions(Permission.CMDB_HEALTH_READ)
  @Perf()
  async getHistory(
    @Headers('x-tenant-id') tenantId: string,
    @Query('limit') limit?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const parsedLimit = limit ? parseInt(limit, 10) : 30;
    const effectiveLimit = isNaN(parsedLimit) ? 30 : Math.min(parsedLimit, 100);
    return this.snapshotService.getHistory(tenantId, effectiveLimit);
  }

  @Post('evaluate')
  @Permissions(Permission.CMDB_HEALTH_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async evaluate(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.evaluationService.evaluate(tenantId, req.user.id);
  }
}
