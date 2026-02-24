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
import { CiClassService } from './ci-class.service';
import { CiClassInheritanceService } from './ci-class-inheritance.service';
import { CreateCiClassDto } from './dto/create-ci-class.dto';
import { UpdateCiClassDto } from './dto/update-ci-class.dto';
import { CiClassFilterDto } from './dto/ci-class-filter.dto';
import { ValidateInheritanceDto } from './dto/validate-inheritance.dto';
import { Perf } from '../../../common/decorators';

@Controller('grc/cmdb/classes')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CiClassController {
  constructor(
    private readonly ciClassService: CiClassService,
    private readonly inheritanceService: CiClassInheritanceService,
  ) {}

  // ========================================================================
  // Static routes MUST come before parameterized :id routes (NestJS matching)
  // ========================================================================

  /**
   * GET /grc/cmdb/classes/tree
   * Returns the full class hierarchy as a nested tree structure.
   */
  @Get('tree')
  @Permissions(Permission.CMDB_CLASS_READ)
  @Perf()
  async getClassTree(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.inheritanceService.getClassTree(tenantId);
  }

  /**
   * GET /grc/cmdb/classes/summary
   * Returns summary counts: total, system, custom, abstract.
   */
  @Get('summary')
  @Permissions(Permission.CMDB_CLASS_READ)
  @Perf()
  async getClassSummary(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.ciClassService.getClassSummary(tenantId);
  }

  /**
   * GET /grc/cmdb/classes/content-pack-status
   * Returns the status of the CMDB baseline content pack for this tenant.
   */
  @Get('content-pack-status')
  @Permissions(Permission.CMDB_CLASS_READ)
  @Perf()
  async getContentPackStatus(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const summary = await this.ciClassService.getClassSummary(tenantId);
    const applied = summary.system > 0;
    return {
      applied,
      version: applied ? 'v1.0.0' : null,
      systemClasses: summary.system,
      customClasses: summary.custom,
      totalClasses: summary.total,
      abstractClasses: summary.abstract,
    };
  }

  // ========================================================================
  // Standard CRUD
  // ========================================================================

  @Get()
  @Permissions(Permission.CMDB_CLASS_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: CiClassFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.ciClassService.findWithFilters(tenantId, filterDto);
  }

  @Post()
  @Permissions(Permission.CMDB_CLASS_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateCiClassDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    // Validate inheritance if parentClassId is provided
    if (dto.parentClassId) {
      const validation =
        await this.inheritanceService.validateInheritanceChange(
          tenantId,
          '', // new class has no ID yet, skip descendant check
          dto.parentClassId,
        );
      if (!validation.valid) {
        throw new BadRequestException(
          `Invalid parent class: ${validation.errors.join('; ')}`,
        );
      }
    }

    return this.ciClassService.createCiClass(tenantId, req.user.id, dto);
  }

  @Get(':id')
  @Permissions(Permission.CMDB_CLASS_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const entity = await this.ciClassService.findOneActiveForTenant(
      tenantId,
      id,
    );
    if (!entity) {
      throw new NotFoundException(`CI Class with ID ${id} not found`);
    }
    return entity;
  }

  @Patch(':id')
  @Permissions(Permission.CMDB_CLASS_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateCiClassDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    // Validate inheritance change if parentClassId is being updated
    if (dto.parentClassId !== undefined) {
      const validation =
        await this.inheritanceService.validateInheritanceChange(
          tenantId,
          id,
          dto.parentClassId,
        );
      if (!validation.valid) {
        throw new BadRequestException(
          `Invalid parent class change: ${validation.errors.join('; ')}`,
        );
      }
    }

    const entity = await this.ciClassService.updateCiClass(
      tenantId,
      req.user.id,
      id,
      dto,
    );
    if (!entity) {
      throw new NotFoundException(`CI Class with ID ${id} not found`);
    }
    return entity;
  }

  @Delete(':id')
  @Permissions(Permission.CMDB_CLASS_WRITE)
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
    const deleted = await this.ciClassService.softDeleteCiClass(
      tenantId,
      req.user.id,
      id,
    );
    if (!deleted) {
      throw new NotFoundException(`CI Class with ID ${id} not found`);
    }
  }

  // ========================================================================
  // Inheritance / Tree endpoints (parameterized)
  // ========================================================================

  /**
   * GET /grc/cmdb/classes/:id/ancestors
   * Returns the ancestor chain from immediate parent up to root.
   */
  @Get(':id/ancestors')
  @Permissions(Permission.CMDB_CLASS_READ)
  @Perf()
  async getAncestors(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const cls = await this.ciClassService.findOneActiveForTenant(tenantId, id);
    if (!cls) {
      throw new NotFoundException(`CI Class with ID ${id} not found`);
    }
    return this.inheritanceService.getAncestorChain(tenantId, id);
  }

  /**
   * GET /grc/cmdb/classes/:id/descendants
   * Returns all descendant class IDs (flat list).
   */
  @Get(':id/descendants')
  @Permissions(Permission.CMDB_CLASS_READ)
  @Perf()
  async getDescendants(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const cls = await this.ciClassService.findOneActiveForTenant(tenantId, id);
    if (!cls) {
      throw new NotFoundException(`CI Class with ID ${id} not found`);
    }
    return this.inheritanceService.getDescendantIds(tenantId, id);
  }

  /**
   * GET /grc/cmdb/classes/:id/effective-schema
   * Returns the effective (merged) schema including inherited + local fields.
   */
  @Get(':id/effective-schema')
  @Permissions(Permission.CMDB_CLASS_READ)
  @Perf()
  async getEffectiveSchema(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.inheritanceService.getEffectiveSchema(tenantId, id);
  }

  /**
   * POST /grc/cmdb/classes/:id/validate-inheritance
   * Validates whether a proposed parent change is safe (cycle, depth, field collisions).
   */
  @Post(':id/validate-inheritance')
  @Permissions(Permission.CMDB_CLASS_WRITE)
  @Perf()
  async validateInheritance(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: ValidateInheritanceDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const cls = await this.ciClassService.findOneActiveForTenant(tenantId, id);
    if (!cls) {
      throw new NotFoundException(`CI Class with ID ${id} not found`);
    }
    return this.inheritanceService.validateInheritanceChange(
      tenantId,
      id,
      dto.parentClassId ?? null,
    );
  }
}
