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
import { Perf } from '../../../common/decorators';
import { ReconcileRuleService } from './reconcile-rule.service';
import {
  CreateReconcileRuleDto,
  UpdateReconcileRuleDto,
  ReconcileRuleFilterDto,
} from './dto/reconcile-rule.dto';

@Controller('grc/cmdb/reconcile-rules')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ReconcileRuleController {
  constructor(private readonly reconcileRuleService: ReconcileRuleService) {}

  @Get()
  @Permissions(Permission.CMDB_IMPORT_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: ReconcileRuleFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.reconcileRuleService.findWithFilters(tenantId, filterDto);
  }

  @Post()
  @Permissions(Permission.CMDB_IMPORT_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateReconcileRuleDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.reconcileRuleService.createForTenant(tenantId, {
      ...dto,
      createdBy: req.user.id,
      isDeleted: false,
    } as Parameters<typeof this.reconcileRuleService.createForTenant>[1]);
  }

  @Get(':id')
  @Permissions(Permission.CMDB_IMPORT_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const entity = await this.reconcileRuleService.findOneForTenant(tenantId, id);
    if (!entity || entity.isDeleted) {
      throw new NotFoundException(`Reconcile rule with ID ${id} not found`);
    }
    return entity;
  }

  @Patch(':id')
  @Permissions(Permission.CMDB_IMPORT_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateReconcileRuleDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const entity = await this.reconcileRuleService.updateForTenant(tenantId, id, {
      ...dto,
      updatedBy: req.user.id,
    } as Parameters<typeof this.reconcileRuleService.updateForTenant>[2]);
    if (!entity) {
      throw new NotFoundException(`Reconcile rule with ID ${id} not found`);
    }
    return entity;
  }

  @Delete(':id')
  @Permissions(Permission.CMDB_IMPORT_WRITE)
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
    const entity = await this.reconcileRuleService.updateForTenant(tenantId, id, {
      isDeleted: true,
      updatedBy: req.user.id,
    } as Parameters<typeof this.reconcileRuleService.updateForTenant>[2]);
    if (!entity) {
      throw new NotFoundException(`Reconcile rule with ID ${id} not found`);
    }
  }
}
