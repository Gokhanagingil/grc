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
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { Perf } from '../../common/decorators';
import { ItsmServiceService } from '../services/itsm-service.service';
import {
  CreateItsmServiceDto,
  UpdateItsmServiceDto,
  ItsmServiceFilterDto,
} from '../dto/itsm.dto';
import { ItsmServiceCriticality, ItsmServiceStatus } from '../enums';

/**
 * ITSM Service Controller
 *
 * Manages IT services for the ITSM module.
 * Services can be linked to incidents and changes for impact analysis.
 * All endpoints require JWT authentication and tenant context.
 */
@ApiTags('ITSM Services')
@ApiBearerAuth()
@ApiHeader({ name: 'x-tenant-id', description: 'Tenant ID', required: true })
@Controller('grc/itsm/services')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ItsmServiceController {
  constructor(private readonly serviceService: ItsmServiceService) {}

  @Post()
  @Permissions(Permission.GRC_CONTROL_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new ITSM service' })
  @ApiResponse({ status: 201, description: 'Service created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateItsmServiceDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const service = await this.serviceService.create(
      tenantId,
      dto,
      req.user.id,
    );
    return { success: true, data: service };
  }

  @Get()
  @Permissions(Permission.GRC_CONTROL_READ)
  @ApiOperation({ summary: 'List all ITSM services' })
  @ApiResponse({ status: 200, description: 'Services retrieved successfully' })
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: ItsmServiceFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const result = await this.serviceService.findAll(tenantId, filter);
    return { success: true, data: result.items, total: result.total };
  }

  @Get('filters')
  @Permissions(Permission.GRC_CONTROL_READ)
  @ApiOperation({ summary: 'Get service filter metadata' })
  @ApiResponse({
    status: 200,
    description: 'Filter metadata returned successfully',
  })
  @Perf()
  getFilters(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return {
      success: true,
      data: {
        criticalities: Object.values(ItsmServiceCriticality),
        statuses: Object.values(ItsmServiceStatus),
      },
    };
  }

  @Get('active')
  @Permissions(Permission.GRC_CONTROL_READ)
  @ApiOperation({ summary: 'Get all active ITSM services' })
  @ApiResponse({
    status: 200,
    description: 'Active services retrieved successfully',
  })
  @Perf()
  async getActiveServices(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const services = await this.serviceService.findActiveServices(tenantId);
    return { success: true, data: services };
  }

  @Get(':id')
  @Permissions(Permission.GRC_CONTROL_READ)
  @ApiOperation({ summary: 'Get a single ITSM service by ID' })
  @ApiResponse({ status: 200, description: 'Service retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const service = await this.serviceService.findOne(tenantId, id);
    return { success: true, data: service };
  }

  @Patch(':id')
  @Permissions(Permission.GRC_CONTROL_WRITE)
  @ApiOperation({ summary: 'Update an ITSM service' })
  @ApiResponse({ status: 200, description: 'Service updated successfully' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateItsmServiceDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const service = await this.serviceService.update(
      tenantId,
      id,
      dto,
      req.user.id,
    );
    return { success: true, data: service };
  }

  @Delete(':id')
  @Permissions(Permission.GRC_CONTROL_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an ITSM service' })
  @ApiResponse({ status: 204, description: 'Service deleted successfully' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  @Perf()
  async delete(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    await this.serviceService.delete(tenantId, id, req.user.id);
  }
}
