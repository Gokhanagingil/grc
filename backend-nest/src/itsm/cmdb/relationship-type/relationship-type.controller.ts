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
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../../auth/permissions/permissions.guard';
import { Permissions } from '../../../auth/permissions/permissions.decorator';
import { Permission } from '../../../auth/permissions/permission.enum';
import { Perf } from '../../../common/decorators';
import { RelationshipTypeService } from './relationship-type.service';
import { CreateRelationshipTypeDto } from './dto/create-relationship-type.dto';
import { UpdateRelationshipTypeDto } from './dto/update-relationship-type.dto';

/**
 * Relationship Type Semantics Controller
 *
 * CRUD endpoints for managing the relationship type catalog.
 * Defines semantic meaning of CI relationship types including
 * directionality, risk propagation, and class compatibility rules.
 *
 * Route: grc/cmdb/relationship-types
 */
@Controller('grc/cmdb/relationship-types')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class RelationshipTypeController {
  constructor(
    private readonly relationshipTypeService: RelationshipTypeService,
  ) {}

  /**
   * List all relationship types for the tenant.
   */
  @Get()
  @Permissions(Permission.CMDB_REL_READ)
  @Perf()
  async findAll(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const items = await this.relationshipTypeService.findAllActive(tenantId);
    return {
      items,
      total: items.length,
      page: 1,
      pageSize: items.length,
      totalPages: 1,
    };
  }

  /**
   * Get a single relationship type by ID.
   */
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
    const entity = await this.relationshipTypeService.findOneActiveForTenant(
      tenantId,
      id,
    );
    if (!entity) {
      throw new NotFoundException(`Relationship type with ID ${id} not found`);
    }
    return entity;
  }

  /**
   * Create a new relationship type.
   */
  @Post()
  @Permissions(Permission.CMDB_REL_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateRelationshipTypeDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.relationshipTypeService.createRelationshipType(
      tenantId,
      req.user.id,
      dto,
    );
  }

  /**
   * Update a relationship type.
   */
  @Patch(':id')
  @Permissions(Permission.CMDB_REL_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateRelationshipTypeDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const entity = await this.relationshipTypeService.updateRelationshipType(
      tenantId,
      req.user.id,
      id,
      dto,
    );
    if (!entity) {
      throw new NotFoundException(`Relationship type with ID ${id} not found`);
    }
    return entity;
  }

  /**
   * Delete a relationship type (soft delete).
   */
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
    const deleted =
      await this.relationshipTypeService.softDeleteRelationshipType(
        tenantId,
        req.user.id,
        id,
      );
    if (!deleted) {
      throw new NotFoundException(`Relationship type with ID ${id} not found`);
    }
  }
}
