import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
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
import { BusinessRuleService } from './business-rule.service';
import { BusinessRuleEngineService } from './business-rule-engine.service';
import { BusinessRule, BusinessRuleTrigger } from './business-rule.entity';
import { CreateBusinessRuleDto } from './dto/create-business-rule.dto';
import { UpdateBusinessRuleDto } from './dto/update-business-rule.dto';

@Controller('grc/itsm/business-rules')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class BusinessRuleController {
  constructor(
    private readonly businessRuleService: BusinessRuleService,
    private readonly businessRuleEngineService: BusinessRuleEngineService,
  ) {}

  @Get()
  @Permissions(Permission.ITSM_BUSINESS_RULE_READ)
  @Perf()
  async findAll(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.businessRuleService.findAllActive(tenantId);
  }

  @Post()
  @Permissions(Permission.ITSM_BUSINESS_RULE_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateBusinessRuleDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.businessRuleService.createRule(
      tenantId,
      req.user.id,
      dto as unknown as Partial<BusinessRule>,
    );
  }

  @Get(':id')
  @Permissions(Permission.ITSM_BUSINESS_RULE_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const rule = await this.businessRuleService.findById(tenantId, id);
    if (!rule) {
      throw new NotFoundException(`Business rule ${id} not found`);
    }
    return rule;
  }

  @Patch(':id')
  @Permissions(Permission.ITSM_BUSINESS_RULE_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateBusinessRuleDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const updated = await this.businessRuleService.updateRule(
      tenantId,
      req.user.id,
      id,
      dto as unknown as Partial<BusinessRule>,
    );
    if (!updated) {
      throw new NotFoundException(`Business rule ${id} not found`);
    }
    return updated;
  }

  @Delete(':id')
  @Permissions(Permission.ITSM_BUSINESS_RULE_WRITE)
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
    const deleted = await this.businessRuleService.softDeleteRule(
      tenantId,
      req.user.id,
      id,
    );
    if (!deleted) {
      throw new NotFoundException(`Business rule ${id} not found`);
    }
  }

  @Post('evaluate')
  @Permissions(Permission.ITSM_BUSINESS_RULE_READ)
  @Perf()
  async evaluate(
    @Headers('x-tenant-id') tenantId: string,
    @Body()
    body: {
      tableName: string;
      trigger: BusinessRuleTrigger;
      record: Record<string, unknown>;
      changes?: Record<string, unknown>;
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const rules = await this.businessRuleService.findByTableAndTrigger(
      tenantId,
      body.tableName,
      body.trigger,
    );
    return this.businessRuleEngineService.evaluateRules(
      rules,
      body.record,
      body.changes,
    );
  }
}
