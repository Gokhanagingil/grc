import {
  Controller,
  Get,
  Post,
  Delete,
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
import { CmdbServiceCiService } from './cmdb-service-ci.service';
import { CmdbServiceService } from '../service/cmdb-service.service';
import { CreateServiceCiDto } from './dto/create-service-ci.dto';
import { ServiceCiFilterDto } from './dto/service-ci-filter.dto';
import { Perf } from '../../../common/decorators';

@Controller('grc/cmdb')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CmdbServiceCiController {
  constructor(
    private readonly serviceCiService: CmdbServiceCiService,
    private readonly cmdbServiceService: CmdbServiceService,
  ) {}

  @Post('services/:serviceId/cis/:ciId')
  @Permissions(Permission.CMDB_SERVICE_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async linkCiToService(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('serviceId') serviceId: string,
    @Param('ciId') ciId: string,
    @Body() dto: CreateServiceCiDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const service = await this.cmdbServiceService.findOneActiveForTenant(
      tenantId,
      serviceId,
    );
    if (!service) {
      throw new NotFoundException(`Service with ID ${serviceId} not found`);
    }

    return this.serviceCiService.linkServiceToCi(
      tenantId,
      req.user.id,
      serviceId,
      ciId,
      dto.relationshipType,
      dto.isPrimary ?? false,
    );
  }

  @Delete('services/:serviceId/cis/:ciId')
  @Permissions(Permission.CMDB_SERVICE_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async unlinkCiFromService(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('serviceId') serviceId: string,
    @Param('ciId') ciId: string,
    @Query('relationshipType') relationshipType?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const deleted = await this.serviceCiService.unlinkServiceFromCi(
      tenantId,
      req.user.id,
      serviceId,
      ciId,
      relationshipType,
    );
    if (!deleted) {
      throw new NotFoundException('Service-CI link not found');
    }
  }

  @Get('services/:serviceId/cis')
  @Permissions(Permission.CMDB_SERVICE_READ)
  @Perf()
  async findCisForService(
    @Headers('x-tenant-id') tenantId: string,
    @Param('serviceId') serviceId: string,
    @Query() filterDto: ServiceCiFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.serviceCiService.findCisForService(
      tenantId,
      serviceId,
      filterDto,
    );
  }

  @Get('cis/:ciId/services')
  @Permissions(Permission.CMDB_SERVICE_READ)
  @Perf()
  async findServicesForCi(
    @Headers('x-tenant-id') tenantId: string,
    @Param('ciId') ciId: string,
    @Query() filterDto: ServiceCiFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.serviceCiService.findServicesForCi(tenantId, ciId, filterDto);
  }
}
