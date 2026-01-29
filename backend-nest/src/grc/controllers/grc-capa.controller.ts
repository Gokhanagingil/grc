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
  normalizeListQuerySort,
  progressiveFilterDecode,
} from '../../common/pipes';
import { parseFilterJson } from '../../common/list-query/list-query.parser';
import { validateFilterAgainstAllowlist } from '../../common/list-query/list-query.validator';
import {
  applyFilterTree,
  applyQuickSearch,
} from '../../common/list-query/list-query.apply';
import {
  CAPA_ALLOWLIST,
  CAPA_SEARCHABLE_COLUMNS,
} from '../../common/list-query/list-query.allowlist';
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
import { GrcCapaTaskService } from '../services/grc-capa-task.service';
import { UpdateCapaStatusDto } from '../dto/closure-loop.dto';
import { CreateCapaDto, UpdateCapaDto } from '../dto/capa.dto';
import { CreateCapaTaskDto } from '../dto/capa-task.dto';
import { CapaType, CapaStatus, CAPAPriority } from '../enums';

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
    'title',
  ]);

  constructor(
    private readonly dataSource: DataSource,
    private readonly closureLoopService: ClosureLoopService,
    private readonly capaService: GrcCapaService,
    private readonly capaTaskService: GrcCapaTaskService,
  ) {}

  /**
   * GET /grc/capas/filters
   * Returns filter metadata for the CAPAs list UI
   * Provides safe arrays of available filter values to prevent UI crashes
   * NOTE: This route MUST be defined BEFORE @Get(':id') to avoid 'filters' being matched as an ID
   */
  @Get('filters')
  @ApiOperation({
    summary: 'Get CAPA filter metadata',
    description: 'Returns available filter values for CAPAs list UI',
  })
  @ApiResponse({
    status: 200,
    description: 'Filter metadata returned successfully',
  })
  @Permissions(Permission.GRC_CAPA_READ)
  @Perf()
  getFilters(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return {
      success: true,
      data: {
        statuses: Object.values(CapaStatus),
        types: Object.values(CapaType),
        priorities: Object.values(CAPAPriority),
      },
    };
  }

  /**
   * GET /grc/capas
   * List all CAPAs for the current tenant with pagination and filtering
   * Supports both legacy individual filters and advanced filter tree
   */
  @Get()
  @Permissions(Permission.GRC_CAPA_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('sort') sort?: string,
    @Query('sortBy') sortByLegacy?: string,
    @Query('sortOrder') sortOrderLegacy?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('priority') priority?: string,
    @Query('issueId') issueId?: string,
    @Query('q') q?: string,
    @Query('search') search?: string,
    @Query('filter') filterJson?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const normalizedSort = normalizeListQuerySort(
      { sort, sortBy: sortByLegacy, sortOrder: sortOrderLegacy },
      'capas',
    );

    const capaRepo = this.dataSource.getRepository(GrcCapa);
    const queryBuilder = capaRepo
      .createQueryBuilder('capa')
      .leftJoinAndSelect('capa.owner', 'owner')
      .leftJoinAndSelect('capa.verifiedBy', 'verifiedBy')
      .leftJoinAndSelect('capa.closedBy', 'closedBy')
      .leftJoinAndSelect('capa.issue', 'issue')
      .where('capa.tenantId = :tenantId', { tenantId })
      .andWhere('capa.isDeleted = :isDeleted', { isDeleted: false });

    if (filterJson) {
      try {
        const decodeResult = progressiveFilterDecode(filterJson);
        if (decodeResult.success && decodeResult.decoded) {
          const parsed = parseFilterJson(decodeResult.decoded);
          if (parsed.tree) {
            validateFilterAgainstAllowlist(parsed.tree, CAPA_ALLOWLIST);
            applyFilterTree(queryBuilder, parsed.tree, CAPA_ALLOWLIST, 'capa');
          }
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException({
          message: 'Invalid filter JSON',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

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

    const searchTerm = q || search;
    if (searchTerm) {
      applyQuickSearch(
        queryBuilder,
        searchTerm,
        CAPA_SEARCHABLE_COLUMNS,
        'capa',
      );
    }

    const [items, total] = await queryBuilder
      .orderBy(`capa.${normalizedSort.sortBy}`, normalizedSort.sortOrder)
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

  /**
   * GET /grc/capas/:capaId/tasks
   * Get all tasks for a CAPA (nested convenience endpoint)
   */
  @Get(':capaId/tasks')
  @ApiOperation({
    summary: 'Get tasks for CAPA',
    description: 'Returns all tasks linked to a specific CAPA',
  })
  @ApiResponse({ status: 200, description: 'Tasks retrieved successfully' })
  @ApiResponse({ status: 404, description: 'CAPA not found' })
  @Permissions(Permission.GRC_CAPA_READ)
  @Perf()
  async getTasksForCapa(
    @Headers('x-tenant-id') tenantId: string,
    @Param('capaId') capaId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.capaService.findOne(tenantId, capaId);

    const tasks = await this.capaTaskService.findByCapaId(tenantId, capaId);
    return { success: true, data: tasks };
  }

  /**
   * POST /grc/capas/:capaId/tasks
   * Create a new task for a CAPA (nested convenience endpoint)
   */
  @Post(':capaId/tasks')
  @ApiOperation({
    summary: 'Create task for CAPA',
    description: 'Creates a new task linked to a specific CAPA',
  })
  @ApiResponse({ status: 201, description: 'Task created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'CAPA not found' })
  @Permissions(Permission.GRC_CAPA_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createTaskForCapa(
    @Headers('x-tenant-id') tenantId: string,
    @Param('capaId') capaId: string,
    @Body() dto: Omit<CreateCapaTaskDto, 'capaId'>,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.capaService.findOne(tenantId, capaId);

    const taskDto: CreateCapaTaskDto = {
      ...dto,
      capaId,
    } as CreateCapaTaskDto;

    const task = await this.capaTaskService.create(
      tenantId,
      taskDto,
      req.user.id,
    );
    return { success: true, data: task };
  }
}
