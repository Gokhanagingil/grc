import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  Request,
  UseGuards,
  ParseUUIDPipe,
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
import { ControlResultService } from '../services/control-result.service';
import { CreateControlResultDto, ControlResultFilterDto } from '../dto';

@Controller('grc/control-results')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ControlResultController {
  constructor(private readonly controlResultService: ControlResultService) {}

  @Get()
  @Permissions(Permission.GRC_CONTROL_READ)
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: ControlResultFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.controlResultService.findWithFilters(tenantId, filterDto);
  }

  @Get(':id')
  @Permissions(Permission.GRC_CONTROL_READ)
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const result = await this.controlResultService.findWithRelations(
      tenantId,
      id,
    );
    if (!result) {
      throw new NotFoundException(`ControlResult with ID ${id} not found`);
    }
    return result;
  }

  @Post()
  @Permissions(Permission.GRC_CONTROL_WRITE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() createDto: CreateControlResultDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.controlResultService.createControlResult(
      tenantId,
      req.user.id,
      createDto,
    );
  }
}
