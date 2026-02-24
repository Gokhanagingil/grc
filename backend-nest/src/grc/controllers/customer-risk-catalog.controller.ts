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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { CustomerRiskCatalogService } from '../services/customer-risk-catalog.service';
import {
  CreateCustomerRiskCatalogDto,
  UpdateCustomerRiskCatalogDto,
  CustomerRiskCatalogFilterDto,
  CreateCustomerRiskBindingDto,
  CustomerRiskBindingFilterDto,
  CustomerRiskObservationFilterDto,
} from '../dto/customer-risk-catalog.dto';
import { Perf } from '../../common/decorators';
import { CustomerRiskCatalog } from '../entities/customer-risk-catalog.entity';

@Controller('grc/customer-risks')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CustomerRiskCatalogController {
  constructor(
    private readonly customerRiskService: CustomerRiskCatalogService,
  ) {}

  @Get('observations/list')
  @Permissions(Permission.GRC_CUSTOMER_RISK_OBSERVATION_READ)
  @Perf()
  async findObservations(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: CustomerRiskObservationFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.customerRiskService.findObservations(tenantId, filterDto);
  }

  @Get()
  @Permissions(Permission.GRC_CUSTOMER_RISK_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: CustomerRiskCatalogFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.customerRiskService.findWithFilters(tenantId, filterDto);
  }

  @Post()
  @Permissions(Permission.GRC_CUSTOMER_RISK_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateCustomerRiskCatalogDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const data: Partial<CustomerRiskCatalog> = {
      ...dto,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
      validTo: dto.validTo ? new Date(dto.validTo) : undefined,
    };
    return this.customerRiskService.createCatalogRisk(
      tenantId,
      req.user.id,
      data,
    );
  }

  @Get(':id')
  @Permissions(Permission.GRC_CUSTOMER_RISK_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const risk = await this.customerRiskService.findOneActiveForTenant(
      tenantId,
      id,
    );
    if (!risk) {
      throw new NotFoundException(`Customer risk with ID ${id} not found`);
    }
    return risk;
  }

  @Patch(':id')
  @Permissions(Permission.GRC_CUSTOMER_RISK_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateCustomerRiskCatalogDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const data: Partial<CustomerRiskCatalog> = {
      ...dto,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
      validTo: dto.validTo ? new Date(dto.validTo) : undefined,
    };
    const updated = await this.customerRiskService.updateCatalogRisk(
      tenantId,
      req.user.id,
      id,
      data,
    );
    if (!updated) {
      throw new NotFoundException(`Customer risk with ID ${id} not found`);
    }
    return updated;
  }

  @Delete(':id')
  @Permissions(Permission.GRC_CUSTOMER_RISK_WRITE)
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
    const deleted = await this.customerRiskService.softDeleteCatalogRisk(
      tenantId,
      req.user.id,
      id,
    );
    if (!deleted) {
      throw new NotFoundException(`Customer risk with ID ${id} not found`);
    }
  }

  @Post(':id/bindings')
  @Permissions(Permission.GRC_CUSTOMER_RISK_BIND_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createBinding(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: CreateCustomerRiskBindingDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.customerRiskService.createBinding(tenantId, req.user.id, id, {
      targetType: dto.targetType,
      targetId: dto.targetId,
      scopeMode: dto.scopeMode,
      enabled: dto.enabled,
      notes: dto.notes,
    });
  }

  @Get(':id/bindings')
  @Permissions(Permission.GRC_CUSTOMER_RISK_BIND_READ)
  @Perf()
  async findBindings(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Query() filterDto: CustomerRiskBindingFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.customerRiskService.findBindingsForRisk(
      tenantId,
      id,
      filterDto,
    );
  }

  @Delete(':id/bindings/:bindingId')
  @Permissions(Permission.GRC_CUSTOMER_RISK_BIND_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async removeBinding(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Param('bindingId') bindingId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const deleted = await this.customerRiskService.deleteBinding(
      tenantId,
      id,
      bindingId,
    );
    if (!deleted) {
      throw new NotFoundException(`Binding ${bindingId} not found`);
    }
  }
}
