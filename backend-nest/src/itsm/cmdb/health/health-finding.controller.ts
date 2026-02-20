import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Headers,
  Request,
  NotFoundException,
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
import { HealthFindingService } from './health-finding.service';
import { FindingFilterDto, WaiveFindingDto } from './dto/health-finding.dto';

@Controller('grc/cmdb/health-findings')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class HealthFindingController {
  constructor(private readonly findingService: HealthFindingService) {}

  @Get()
  @Permissions(Permission.CMDB_HEALTH_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: FindingFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.findingService.findWithFilters(tenantId, filterDto);
  }

  @Get(':id')
  @Permissions(Permission.CMDB_HEALTH_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const finding = await this.findingService.findOneForTenant(tenantId, id);
    if (!finding || finding.isDeleted) {
      throw new NotFoundException(`Health finding with ID ${id} not found`);
    }
    return finding;
  }

  @Post(':id/waive')
  @Permissions(Permission.CMDB_HEALTH_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async waive(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: WaiveFindingDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const result = await this.findingService.waiveFinding(
      tenantId,
      id,
      req.user.id,
      dto.reason,
    );
    if (!result) {
      throw new NotFoundException(`Health finding with ID ${id} not found`);
    }
    return result;
  }
}
