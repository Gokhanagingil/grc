import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { GrcCapaTaskService } from '../services/grc-capa-task.service';
import {
  CreateCapaTaskDto,
  UpdateCapaTaskDto,
  UpdateCapaTaskStatusDto,
  CompleteCapaTaskDto,
  CapaTaskFilterDto,
} from '../dto/capa-task.dto';

@Controller('grc/capa-tasks')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GrcCapaTaskController {
  constructor(private readonly capaTaskService: GrcCapaTaskService) {}

  @Post()
  @Permissions(Permission.GRC_CAPA_WRITE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateCapaTaskDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.capaTaskService.create(tenantId, dto, req.user.id);
  }

  @Get()
  @Permissions(Permission.GRC_CAPA_READ)
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: CapaTaskFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.capaTaskService.findAll(tenantId, filter);
  }

  @Get(':id')
  @Permissions(Permission.GRC_CAPA_READ)
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.capaTaskService.findOne(tenantId, id);
  }

  @Get('by-capa/:capaId')
  @Permissions(Permission.GRC_CAPA_READ)
  async findByCapaId(
    @Headers('x-tenant-id') tenantId: string,
    @Param('capaId') capaId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.capaTaskService.findByCapaId(tenantId, capaId);
  }

  @Get('by-capa/:capaId/stats')
  @Permissions(Permission.GRC_CAPA_READ)
  async getTaskCompletionStats(
    @Headers('x-tenant-id') tenantId: string,
    @Param('capaId') capaId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.capaTaskService.getTaskCompletionStats(tenantId, capaId);
  }

  @Put(':id')
  @Permissions(Permission.GRC_CAPA_WRITE)
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCapaTaskDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.capaTaskService.update(tenantId, id, dto, req.user.id);
  }

  @Patch(':id/status')
  @Permissions(Permission.GRC_CAPA_WRITE)
  async updateStatus(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCapaTaskStatusDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.capaTaskService.updateStatus(tenantId, id, dto, req.user.id);
  }

  @Patch(':id/complete')
  @Permissions(Permission.GRC_CAPA_WRITE)
  async complete(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: CompleteCapaTaskDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.capaTaskService.complete(tenantId, id, dto, req.user.id);
  }

  @Delete(':id')
  @Permissions(Permission.GRC_CAPA_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    await this.capaTaskService.softDelete(tenantId, id, req.user.id);
  }
}
