import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
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
import { ProcessControlService } from '../services/process-control.service';
import {
  CreateProcessControlDto,
  UpdateProcessControlDto,
  ProcessControlFilterDto,
  LinkRisksToControlDto,
} from '../dto';

@Controller('grc/process-controls')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ProcessControlController {
  constructor(private readonly processControlService: ProcessControlService) {}

  @Get()
  @Permissions(Permission.GRC_CONTROL_READ)
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: ProcessControlFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.processControlService.findWithFilters(tenantId, filterDto);
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
    const control = await this.processControlService.findWithRelations(
      tenantId,
      id,
    );
    if (!control) {
      throw new NotFoundException(`ProcessControl with ID ${id} not found`);
    }
    return control;
  }

  @Get(':id/risks')
  @Permissions(Permission.GRC_CONTROL_READ)
  async getLinkedRisks(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const control = await this.processControlService.findOneActiveForTenant(
      tenantId,
      id,
    );
    if (!control) {
      throw new NotFoundException(`ProcessControl with ID ${id} not found`);
    }
    return this.processControlService.getLinkedRisks(tenantId, id);
  }

  @Post()
  @Permissions(Permission.GRC_CONTROL_WRITE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() createDto: CreateProcessControlDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.processControlService.createProcessControl(
      tenantId,
      req.user.id,
      createDto,
    );
  }

  @Patch(':id')
  @Permissions(Permission.GRC_CONTROL_WRITE)
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateProcessControlDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const control = await this.processControlService.updateProcessControl(
      tenantId,
      req.user.id,
      id,
      updateDto,
    );
    if (!control) {
      throw new NotFoundException(`ProcessControl with ID ${id} not found`);
    }
    return control;
  }

  @Put(':id/risks')
  @Permissions(Permission.GRC_CONTROL_WRITE)
  async linkRisks(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() linkDto: LinkRisksToControlDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.processControlService.linkRisks(tenantId, id, linkDto.riskIds);
  }

  @Delete(':id')
  @Permissions(Permission.GRC_CONTROL_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const deleted = await this.processControlService.softDeleteProcessControl(
      tenantId,
      req.user.id,
      id,
    );
    if (!deleted) {
      throw new NotFoundException(`ProcessControl with ID ${id} not found`);
    }
  }
}
