/**
 * CMDB CI Class Relationship Rule Controller
 *
 * Provides CRUD for class-level relationship rules and
 * the effective (inheritance-aware) rules endpoint.
 *
 * Routes:
 *   GET    /grc/cmdb/class-relationship-rules          — list rules
 *   POST   /grc/cmdb/class-relationship-rules          — create rule
 *   GET    /grc/cmdb/class-relationship-rules/:id      — get rule
 *   PATCH  /grc/cmdb/class-relationship-rules/:id      — update rule
 *   DELETE /grc/cmdb/class-relationship-rules/:id      — soft delete rule
 *
 * Effective rules endpoint on CiClassController:
 *   GET    /grc/cmdb/classes/:id/relationship-rules/effective
 */

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
import { CiClassRelationshipRuleService } from './ci-class-relationship-rule.service';
import { CreateClassRelationshipRuleDto } from './dto/create-class-relationship-rule.dto';
import { UpdateClassRelationshipRuleDto } from './dto/update-class-relationship-rule.dto';
import { Perf } from '../../../common/decorators';

@Controller('grc/cmdb/class-relationship-rules')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CiClassRelationshipRuleController {
  constructor(
    private readonly ruleService: CiClassRelationshipRuleService,
  ) {}

  @Get()
  @Permissions(Permission.CMDB_REL_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query('sourceClassId') sourceClassId?: string,
    @Query('targetClassId') targetClassId?: string,
    @Query('relationshipTypeId') relationshipTypeId?: string,
    @Query('isActive') isActiveStr?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const isActive =
      isActiveStr === 'true' ? true : isActiveStr === 'false' ? false : undefined;

    const items = await this.ruleService.findAllForTenant(tenantId, {
      sourceClassId,
      targetClassId,
      relationshipTypeId,
      isActive,
    });
    return { data: items, total: items.length };
  }

  @Post()
  @Permissions(Permission.CMDB_REL_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateClassRelationshipRuleDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.ruleService.createRule(tenantId, req.user.id, dto);
  }

  @Get(':id')
  @Permissions(Permission.CMDB_REL_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const entity = await this.ruleService.findOneForTenant(tenantId, id);
    if (!entity) {
      throw new NotFoundException(
        `Class relationship rule with ID ${id} not found`,
      );
    }
    return entity;
  }

  @Patch(':id')
  @Permissions(Permission.CMDB_REL_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateClassRelationshipRuleDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const entity = await this.ruleService.updateRule(
      tenantId,
      req.user.id,
      id,
      dto,
    );
    if (!entity) {
      throw new NotFoundException(
        `Class relationship rule with ID ${id} not found`,
      );
    }
    return entity;
  }

  @Delete(':id')
  @Permissions(Permission.CMDB_REL_WRITE)
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
    const deleted = await this.ruleService.softDeleteRule(
      tenantId,
      req.user.id,
      id,
    );
    if (!deleted) {
      throw new NotFoundException(
        `Class relationship rule with ID ${id} not found`,
      );
    }
  }
}
