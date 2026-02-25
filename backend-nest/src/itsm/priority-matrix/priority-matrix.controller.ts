import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  Headers,
  Request,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { Perf } from '../../common/decorators';
import { PriorityMatrixService } from './priority-matrix.service';
import { UpsertPriorityMatrixDto } from './dto/upsert-priority-matrix.dto';

/**
 * Priority Matrix Controller
 *
 * ITSM Studio admin API for managing the incident priority matrix.
 * The matrix maps (impact, urgency) pairs to priority levels.
 *
 * Routes:
 * - GET  /grc/itsm/priority-matrix       → get current matrix for tenant
 * - PUT  /grc/itsm/priority-matrix       → replace entire matrix (admin)
 * - POST /grc/itsm/priority-matrix/seed  → seed default ITIL matrix if empty
 */
@Controller('grc/itsm/priority-matrix')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class PriorityMatrixController {
  constructor(private readonly matrixService: PriorityMatrixService) {}

  /**
   * GET /grc/itsm/priority-matrix
   * Get the current priority matrix for the tenant.
   * Returns default ITIL matrix if no tenant-specific overrides exist.
   */
  @Get()
  @Permissions(Permission.ITSM_INCIDENT_READ)
  @Perf()
  async getMatrix(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const rows = await this.matrixService.getMatrix(tenantId);
    return rows;
  }

  /**
   * PUT /grc/itsm/priority-matrix
   * Replace the entire priority matrix for the tenant.
   * Requires admin/write permissions.
   */
  @Put()
  @Permissions(Permission.ITSM_INCIDENT_WRITE)
  @Perf()
  async upsertMatrix(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: UpsertPriorityMatrixDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const rows = await this.matrixService.upsertMatrix(
      tenantId,
      req.user.id,
      dto.entries,
    );
    return rows;
  }

  /**
   * POST /grc/itsm/priority-matrix/seed
   * Seed the default ITIL priority matrix for the tenant.
   * Idempotent - does nothing if matrix already exists.
   */
  @Post('seed')
  @Permissions(Permission.ITSM_INCIDENT_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async seedDefault(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const seeded = await this.matrixService.seedDefaultIfEmpty(
      tenantId,
      req.user.id,
    );
    return { seeded };
  }
}
