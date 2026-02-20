import {
  Controller,
  Get,
  Post,
  Patch,
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
import { CmdbServiceOfferingService } from './cmdb-service-offering.service';
import { CmdbServiceService } from '../service/cmdb-service.service';
import { CreateOfferingDto } from './dto/create-offering.dto';
import { UpdateOfferingDto } from './dto/update-offering.dto';
import { OfferingFilterDto } from './dto/offering-filter.dto';
import { Perf } from '../../../common/decorators';

@Controller('grc/cmdb/service-offerings')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CmdbServiceOfferingController {
  constructor(
    private readonly offeringService: CmdbServiceOfferingService,
    private readonly cmdbServiceService: CmdbServiceService,
  ) {}

  @Get()
  @Permissions(Permission.CMDB_SERVICE_OFFERING_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: OfferingFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.offeringService.findWithFilters(tenantId, filterDto);
  }

  @Post()
  @Permissions(Permission.CMDB_SERVICE_OFFERING_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateOfferingDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const service = await this.cmdbServiceService.findOneActiveForTenant(
      tenantId,
      dto.serviceId,
    );
    if (!service) {
      throw new BadRequestException(
        `Service with ID ${dto.serviceId} not found for this tenant`,
      );
    }
    return this.offeringService.createOffering(tenantId, req.user.id, dto);
  }

  @Get(':id')
  @Permissions(Permission.CMDB_SERVICE_OFFERING_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const entity = await this.offeringService.findOneActiveForTenant(
      tenantId,
      id,
    );
    if (!entity) {
      throw new NotFoundException(`Offering with ID ${id} not found`);
    }
    return entity;
  }

  @Patch(':id')
  @Permissions(Permission.CMDB_SERVICE_OFFERING_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateOfferingDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const entity = await this.offeringService.updateOffering(
      tenantId,
      req.user.id,
      id,
      dto,
    );
    if (!entity) {
      throw new NotFoundException(`Offering with ID ${id} not found`);
    }
    return entity;
  }

  @Delete(':id')
  @Permissions(Permission.CMDB_SERVICE_OFFERING_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async remove(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const deleted = await this.offeringService.softDeleteOffering(
      tenantId,
      req.user.id,
      id,
    );
    if (!deleted) {
      throw new NotFoundException(`Offering with ID ${id} not found`);
    }
  }
}
