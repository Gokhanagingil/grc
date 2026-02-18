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
import { Perf } from '../../common/decorators';
import { SlaService } from './sla.service';
import { CreateSlaDefinitionDto } from './dto/create-sla-definition.dto';
import { UpdateSlaDefinitionDto } from './dto/update-sla-definition.dto';
import {
  SlaDefinitionFilterDto,
  SlaInstanceFilterDto,
} from './dto/sla-filter.dto';

@Controller('grc/itsm/sla')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  @Get('definitions')
  @Permissions(Permission.ITSM_SLA_READ)
  @Perf()
  async listDefinitions(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: SlaDefinitionFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.slaService.findDefinitionsWithFilters(tenantId, filterDto);
  }

  @Post('definitions')
  @Permissions(Permission.ITSM_SLA_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createDefinition(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateSlaDefinitionDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.slaService.createDefinition(tenantId, req.user.id, dto);
  }

  @Get('definitions/:id')
  @Permissions(Permission.ITSM_SLA_READ)
  @Perf()
  async getDefinition(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const def = await this.slaService.findDefinitionById(tenantId, id);
    if (!def) {
      throw new NotFoundException(`SLA definition ${id} not found`);
    }
    return def;
  }

  @Patch('definitions/:id')
  @Permissions(Permission.ITSM_SLA_WRITE)
  @Perf()
  async updateDefinition(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateSlaDefinitionDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const def = await this.slaService.updateDefinition(
      tenantId,
      req.user.id,
      id,
      dto,
    );
    if (!def) {
      throw new NotFoundException(`SLA definition ${id} not found`);
    }
    return def;
  }

  @Delete('definitions/:id')
  @Permissions(Permission.ITSM_SLA_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async deleteDefinition(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const deleted = await this.slaService.softDeleteDefinition(
      tenantId,
      req.user.id,
      id,
    );
    if (!deleted) {
      throw new NotFoundException(`SLA definition ${id} not found`);
    }
  }

  @Get('instances')
  @Permissions(Permission.ITSM_SLA_READ)
  @Perf()
  async listInstances(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: SlaInstanceFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.slaService.findInstancesWithFilters(tenantId, filterDto);
  }

  @Get('records/:recordType/:recordId')
  @Permissions(Permission.ITSM_SLA_READ)
  @Perf()
  async getRecordSlas(
    @Headers('x-tenant-id') tenantId: string,
    @Param('recordType') recordType: string,
    @Param('recordId') recordId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.slaService.getInstancesForRecord(
      tenantId,
      recordType,
      recordId,
    );
  }

  @Post('instances/:id/recompute')
  @Permissions(Permission.ITSM_SLA_WRITE)
  @Perf()
  async recomputeInstance(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const instance = await this.slaService.recomputeInstance(tenantId, id);
    if (!instance) {
      throw new NotFoundException(`SLA instance ${id} not found`);
    }
    return instance;
  }
}
