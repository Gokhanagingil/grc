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
import { HealthRuleService } from './health-rule.service';
import {
  CreateHealthRuleDto,
  UpdateHealthRuleDto,
  HealthRuleFilterDto,
} from './dto/health-rule.dto';

@Controller('grc/cmdb/health-rules')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class HealthRuleController {
  constructor(private readonly ruleService: HealthRuleService) {}

  @Get()
  @Permissions(Permission.CMDB_HEALTH_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: HealthRuleFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const rules = await this.ruleService.findActiveRules(tenantId);
    let filtered = rules;

    if (filterDto.severity) {
      filtered = filtered.filter((r) => r.severity === filterDto.severity);
    }
    if (filterDto.enabled !== undefined) {
      filtered = filtered.filter((r) => r.enabled === filterDto.enabled);
    }

    return { items: filtered, total: filtered.length };
  }

  @Post()
  @Permissions(Permission.CMDB_HEALTH_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateHealthRuleDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.ruleService.createForTenant(tenantId, {
      ...dto,
      createdBy: req.user.id,
    });
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
    const rule = await this.ruleService.findOneForTenant(tenantId, id);
    if (!rule || rule.isDeleted) {
      throw new NotFoundException(`Health rule with ID ${id} not found`);
    }
    return rule;
  }

  @Patch(':id')
  @Permissions(Permission.CMDB_HEALTH_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateHealthRuleDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const existing = await this.ruleService.findOneForTenant(tenantId, id);
    if (!existing || existing.isDeleted) {
      throw new NotFoundException(`Health rule with ID ${id} not found`);
    }
    return this.ruleService.updateForTenant(tenantId, id, {
      ...dto,
      updatedBy: req.user.id,
    });
  }

  @Delete(':id')
  @Permissions(Permission.CMDB_HEALTH_WRITE)
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
    const existing = await this.ruleService.findOneForTenant(tenantId, id);
    if (!existing || existing.isDeleted) {
      throw new NotFoundException(`Health rule with ID ${id} not found`);
    }
    await this.ruleService.updateForTenant(tenantId, id, {
      isDeleted: true,
      updatedBy: req.user.id,
    } as Partial<
      Omit<
        import('./cmdb-health-rule.entity').CmdbHealthRule,
        'id' | 'tenantId'
      >
    >);
  }
}
