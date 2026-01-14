import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Headers,
  Request,
  UseGuards,
  BadRequestException,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { DataSource, FindOptionsWhere } from 'typeorm';
import { GrcCapa } from '../entities/grc-capa.entity';
import { Perf } from '../../common/decorators';
import { ClosureLoopService } from '../services/closure-loop.service';
import { GrcCapaService } from '../services/grc-capa.service';
import { UpdateCapaStatusDto } from '../dto/closure-loop.dto';
import { CreateCapaDto, UpdateCapaDto } from '../dto/capa.dto';

/**
 * GRC CAPA Controller
 *
 * Provides list and read endpoints for GRC CAPAs (Corrective and Preventive Actions).
 * All endpoints require JWT authentication and tenant context.
 * Read operations require GRC_CAPA_READ permission.
 */
@ApiTags('GRC CAPAs')
@ApiBearerAuth()
@ApiHeader({ name: 'x-tenant-id', description: 'Tenant ID', required: true })
@Controller('grc/capas')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GrcCapaController {
  private readonly allowedSortFields: Set<string> = new Set([
    'createdAt',
    'updatedAt',
    'status',
    'type',
    'priority',
    'dueDate',
    'completedDate',
    'verifiedAt',
    'closedAt',
  ]);

  constructor(
    private readonly dataSource: DataSource,
    private readonly closureLoopService: ClosureLoopService,
    private readonly capaService: GrcCapaService,
  ) {}

  /**
   * GET /grc/capas
   * List all CAPAs for the current tenant with pagination and filtering
   */
  @Get()
  @Permissions(Permission.GRC_CAPA_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('sortBy') sortBy = 'createdAt',
    @Query('sortOrder') sortOrder: 'ASC' | 'DESC' = 'DESC',
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('priority') priority?: string,
    @Query('issueId') issueId?: string,
    @Query('q') search?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const capaRepo = this.dataSource.getRepository(GrcCapa);
    const queryBuilder = capaRepo
      .createQueryBuilder('capa')
      .leftJoinAndSelect('capa.owner', 'owner')
      .leftJoinAndSelect('capa.verifiedBy', 'verifiedBy')
      .leftJoinAndSelect('capa.closedBy', 'closedBy')
      .leftJoinAndSelect('capa.issue', 'issue')
      .where('capa.tenantId = :tenantId', { tenantId })
      .andWhere('capa.isDeleted = :isDeleted', { isDeleted: false });

    if (status) {
      queryBuilder.andWhere('capa.status = :status', { status });
    }

    if (type) {
      queryBuilder.andWhere('capa.type = :type', { type });
    }

    if (priority) {
      queryBuilder.andWhere('capa.priority = :priority', { priority });
    }

    if (issueId) {
      queryBuilder.andWhere('capa.issueId = :issueId', { issueId });
    }

    if (search) {
      queryBuilder.andWhere(
        '(capa.title ILIKE :search OR capa.description ILIKE :search OR capa.rootCauseAnalysis ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const safeSortBy = this.allowedSortFields.has(sortBy)
      ? sortBy
      : 'createdAt';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const [items, total] = await queryBuilder
      .orderBy(`capa.${safeSortBy}`, safeSortOrder)
      .skip((Number(page) - 1) * Number(pageSize))
      .take(Number(pageSize))
      .getManyAndCount();

    return {
      items,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / Number(pageSize)),
    };
  }

  /**
   * GET /grc/capas/:id
   * Get a specific CAPA by ID
   */
  @Get(':id')
  @Permissions(Permission.GRC_CAPA_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const capaRepo = this.dataSource.getRepository(GrcCapa);
    const capa = await capaRepo.findOne({
      where: {
        id,
        tenantId,
        isDeleted: false,
      } as FindOptionsWhere<GrcCapa>,
      relations: ['owner', 'verifiedBy', 'closedBy', 'issue', 'tasks'],
    });

    if (!capa) {
      throw new NotFoundException(`CAPA with ID ${id} not found`);
    }

    return capa;
  }

  /**
   * PATCH /grc/capas/:id/status
   * Update the status of a CAPA with validation and cascade logic
   */
  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update CAPA status',
    description:
      'Updates the status of a CAPA with transition validation. ' +
      'When a CAPA is closed, it may trigger cascade closure of the linked Issue ' +
      'if all CAPAs for that Issue are closed.',
  })
  @ApiResponse({ status: 200, description: 'CAPA status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'CAPA not found' })
  @Permissions(Permission.GRC_CAPA_WRITE)
  @Perf()
  async updateStatus(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCapaStatusDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const result = await this.closureLoopService.updateCapaStatus(
      tenantId,
      id,
      dto,
      req.user.id,
    );

    return { success: true, data: result };
  }

  /**
   * POST /grc/capas
   * Create a new CAPA
   */
  @Post()
  @ApiOperation({
    summary: 'Create a new CAPA',
    description: 'Creates a new CAPA linked to an Issue',
  })
  @ApiResponse({ status: 201, description: 'CAPA created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Issue not found' })
  @Permissions(Permission.GRC_CAPA_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateCapaDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const capa = await this.capaService.create(tenantId, dto, req.user.id);
    return { success: true, data: capa };
  }

  /**
   * PATCH /grc/capas/:id
   * Update a CAPA (general fields, not status)
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a CAPA',
    description:
      'Updates CAPA fields (use PATCH /:id/status for status changes)',
  })
  @ApiResponse({ status: 200, description: 'CAPA updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'CAPA not found' })
  @Permissions(Permission.GRC_CAPA_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCapaDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const capa = await this.capaService.update(tenantId, id, dto, req.user.id);
    return { success: true, data: capa };
  }

  /**
   * DELETE /grc/capas/:id
   * Soft delete a CAPA
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a CAPA',
    description: 'Soft deletes a CAPA',
  })
  @ApiResponse({ status: 204, description: 'CAPA deleted successfully' })
  @ApiResponse({ status: 404, description: 'CAPA not found' })
  @Permissions(Permission.GRC_CAPA_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async delete(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.capaService.delete(tenantId, id, req.user.id);
  }

  /**
   * GET /grc/capas/by-issue/:issueId
   * Get all CAPAs linked to an Issue
   */
  @Get('by-issue/:issueId')
  @ApiOperation({
    summary: 'Get CAPAs by Issue',
    description: 'Returns all CAPAs linked to a specific Issue',
  })
  @ApiResponse({ status: 200, description: 'CAPAs retrieved successfully' })
  @Permissions(Permission.GRC_CAPA_READ)
  @Perf()
  async findByIssue(
    @Headers('x-tenant-id') tenantId: string,
    @Param('issueId') issueId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const capas = await this.capaService.findByIssue(tenantId, issueId);
    return { success: true, data: capas };
  }
}
