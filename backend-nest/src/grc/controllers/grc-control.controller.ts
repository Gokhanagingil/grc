import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Headers,
  UseGuards,
  BadRequestException,
  NotFoundException,
  ConflictException,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { DataSource, FindOptionsWhere } from 'typeorm';
import { GrcControl } from '../entities/grc-control.entity';
import { GrcControlProcess } from '../entities/grc-control-process.entity';
import { GrcControlEvidence } from '../entities/grc-control-evidence.entity';
import { Process } from '../entities/process.entity';
import { Perf } from '../../common/decorators';
import { ControlStatus, ControlType } from '../enums';
import {
  UniversalListService,
  ListQueryDto,
  UniversalListConfig,
  ListResponse,
  parseFilterJson,
  validateFilterAgainstAllowlist,
  applyFilterTree,
  applyQuickSearch,
  validateQuickSearch,
  CONTROL_ALLOWLIST,
  CONTROL_SEARCHABLE_COLUMNS,
  resetParamCounter,
} from '../../common';

/**
 * GRC Control Controller
 *
 * Provides list and read endpoints for GRC Controls.
 * All endpoints require JWT authentication and tenant context.
 * Read operations require GRC_CONTROL_READ permission.
 */
/**
 * Universal List Configuration for Controls
 * Defines searchable columns, sortable fields, and filters
 */
const CONTROL_LIST_CONFIG: UniversalListConfig = {
  searchableColumns: [
    { column: 'name' },
    { column: 'code' },
    { column: 'description' },
  ],
  sortableFields: [
    { field: 'createdAt' },
    { field: 'updatedAt' },
    { field: 'name' },
    { field: 'code' },
    { field: 'status' },
    { field: 'type' },
    { field: 'frequency' },
    { field: 'lastTestedDate' },
    { field: 'nextTestDate' },
  ],
  filters: [
    {
      field: 'status',
      type: 'enum',
      enumValues: [
        'draft',
        'in_design',
        'implemented',
        'inoperative',
        'retired',
      ],
      caseInsensitive: true,
    },
    {
      field: 'type',
      type: 'enum',
      enumValues: ['preventive', 'detective', 'corrective'],
      caseInsensitive: true,
    },
  ],
  defaultSort: { field: 'createdAt', direction: 'DESC' },
};

@Controller('grc/controls')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GrcControlController {
  private readonly allowedSortFields: Set<string> = new Set([
    'createdAt',
    'updatedAt',
    'name',
    'code',
    'status',
    'type',
    'frequency',
    'lastTestedDate',
    'nextTestDate',
  ]);

  constructor(
    private readonly dataSource: DataSource,
    private readonly universalListService: UniversalListService,
  ) {}

  /**
   * Normalize and validate control status filter (case-insensitive)
   */
  private normalizeStatus(status: string): ControlStatus {
    const normalized = status.toLowerCase();
    const statusMap: Record<string, ControlStatus> = {
      draft: ControlStatus.DRAFT,
      in_design: ControlStatus.IN_DESIGN,
      implemented: ControlStatus.IMPLEMENTED,
      inoperative: ControlStatus.INOPERATIVE,
      retired: ControlStatus.RETIRED,
    };
    const result = statusMap[normalized];
    if (!result) {
      const allowedValues = Object.keys(statusMap).join(', ');
      throw new BadRequestException(
        `Invalid status value: '${status}'. Allowed values: ${allowedValues}`,
      );
    }
    return result;
  }

  /**
   * Normalize and validate control type filter (case-insensitive)
   */
  private normalizeType(type: string): ControlType {
    const normalized = type.toLowerCase();
    const typeMap: Record<string, ControlType> = {
      preventive: ControlType.PREVENTIVE,
      detective: ControlType.DETECTIVE,
      corrective: ControlType.CORRECTIVE,
    };
    const result = typeMap[normalized];
    if (!result) {
      const allowedValues = Object.keys(typeMap).join(', ');
      throw new BadRequestException(
        `Invalid type value: '${type}'. Allowed values: ${allowedValues}`,
      );
    }
    return result;
  }

  /**
   * GET /grc/controls
   * List all controls for the current tenant with pagination and filtering
   *
   * List Contract compliant endpoint using UniversalListService:
   * - page, limit (or pageSize): pagination
   * - sort: field:dir format (e.g., createdAt:DESC)
   * - search: text search in name, code, description
   * - q: quick search (max 120 chars) - searches name, code, description
   * - filter: JSON filter tree (URI-encoded) for advanced filtering
   * - status: filter by control status (case-insensitive) - legacy param
   * - type: filter by control type (case-insensitive) - legacy param
   * - requirementId: filter controls linked to a specific requirement
   * - processId: filter controls linked to a specific process
   * - unlinked: if 'true', return controls with no requirement AND no process links
   *
   * Advanced Filter JSON format:
   * { "and": [{ "field": "status", "op": "is", "value": "implemented" }] }
   * { "or": [{ "field": "name", "op": "contains", "value": "access" }] }
   * Single condition: { "field": "status", "op": "is", "value": "draft" }
   *
   * Supported operators: is, is_not, is_empty, is_not_empty, contains, not_contains,
   *                      after, before, gt, lt, gte, lte
   */
  @Get()
  @Permissions(Permission.GRC_CONTROL_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy = 'createdAt',
    @Query('sortOrder') sortOrder: 'ASC' | 'DESC' = 'DESC',
    @Query('sort') sort?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('q') quickSearch?: string,
    @Query('filter') filterJson?: string,
    @Query('requirementId') requirementId?: string,
    @Query('processId') processId?: string,
    @Query('unlinked') unlinked?: string,
  ): Promise<ListResponse<GrcControl>> {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    // Reset param counter for unique parameter names
    resetParamCounter();

    const listQuery = new ListQueryDto();
    listQuery.page = Number(page);
    listQuery.pageSize = Number(pageSize);
    listQuery.limit = limit ? Number(limit) : undefined;
    listQuery.search = search;
    listQuery.sort = sort;
    listQuery.sortBy = sortBy;
    listQuery.sortOrder = sortOrder;

    const controlRepo = this.dataSource.getRepository(GrcControl);
    const queryBuilder = controlRepo
      .createQueryBuilder('control')
      .leftJoinAndSelect('control.owner', 'owner');

    this.universalListService.applyTenantFilter(
      queryBuilder,
      tenantId,
      'control',
    );
    this.universalListService.applySoftDeleteFilter(queryBuilder, 'control');

    // Apply quick search (q parameter) - searches name, code, description
    const sanitizedQuickSearch = validateQuickSearch(quickSearch);
    if (sanitizedQuickSearch) {
      applyQuickSearch(
        queryBuilder,
        sanitizedQuickSearch,
        CONTROL_SEARCHABLE_COLUMNS,
        'control',
      );
    }

    // Apply advanced filter (filter parameter)
    if (filterJson) {
      try {
        const decodedFilter = decodeURIComponent(filterJson);
        const parsedFilter = parseFilterJson(decodedFilter);
        validateFilterAgainstAllowlist(parsedFilter.tree, CONTROL_ALLOWLIST);
        applyFilterTree(
          queryBuilder,
          parsedFilter.tree,
          CONTROL_ALLOWLIST,
          'control',
        );
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          `Invalid filter: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    // Apply legacy filters (status, type) for backward compatibility
    if (requirementId) {
      queryBuilder.andWhere(
        `control.id IN (
          SELECT rc.control_id FROM grc_requirement_controls rc 
          WHERE rc.requirement_id = :requirementId AND rc.tenant_id = :tenantId
        )`,
        { requirementId, tenantId },
      );
    }

    if (processId) {
      queryBuilder.andWhere(
        `control.id IN (
          SELECT cp.control_id FROM grc_control_processes cp 
          WHERE cp.process_id = :processId AND cp.tenant_id = :tenantId
        )`,
        { processId, tenantId },
      );
    }

    if (unlinked === 'true') {
      queryBuilder.andWhere(
        `control.id NOT IN (
          SELECT rc.control_id FROM grc_requirement_controls rc 
          WHERE rc.tenant_id = :tenantId
        )`,
        { tenantId },
      );
      queryBuilder.andWhere(
        `control.id NOT IN (
          SELECT cp.control_id FROM grc_control_processes cp 
          WHERE cp.tenant_id = :tenantId
        )`,
        { tenantId },
      );
    }

    return this.universalListService.executeListQuery(
      queryBuilder,
      listQuery,
      CONTROL_LIST_CONFIG,
      'control',
      { status, type },
    );
  }

  /**
   * GET /grc/controls/:id
   * Get a specific control by ID with all linked entities
   */
  @Get(':id')
  @Permissions(Permission.GRC_CONTROL_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const controlRepo = this.dataSource.getRepository(GrcControl);
    const control = await controlRepo.findOne({
      where: {
        id,
        tenantId,
        isDeleted: false,
      } as FindOptionsWhere<GrcControl>,
      relations: [
        'owner',
        'controlTests',
        'controlEvidence',
        'riskControls',
        'policyControls',
        'requirementControls',
        'requirementControls.requirement',
        'controlProcesses',
        'controlProcesses.process',
      ],
    });

    if (!control) {
      throw new NotFoundException(`Control with ID ${id} not found`);
    }

    return control;
  }

  /**
   * POST /grc/controls/:controlId/processes/:processId
   * Link a control to a process
   */
  @Post(':controlId/processes/:processId')
  @Permissions(Permission.GRC_CONTROL_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async linkProcess(
    @Headers('x-tenant-id') tenantId: string,
    @Param('controlId', ParseUUIDPipe) controlId: string,
    @Param('processId', ParseUUIDPipe) processId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const controlRepo = this.dataSource.getRepository(GrcControl);
    const processRepo = this.dataSource.getRepository(Process);
    const linkRepo = this.dataSource.getRepository(GrcControlProcess);

    // Verify control exists and belongs to tenant
    const control = await controlRepo.findOne({
      where: {
        id: controlId,
        tenantId,
        isDeleted: false,
      } as FindOptionsWhere<GrcControl>,
    });
    if (!control) {
      throw new NotFoundException(`Control with ID ${controlId} not found`);
    }

    // Verify process exists and belongs to tenant
    const process = await processRepo.findOne({
      where: {
        id: processId,
        tenantId,
        isDeleted: false,
      } as FindOptionsWhere<Process>,
    });
    if (!process) {
      throw new NotFoundException(`Process with ID ${processId} not found`);
    }

    // Check if link already exists
    const existingLink = await linkRepo.findOne({
      where: {
        controlId,
        processId,
        tenantId,
      } as FindOptionsWhere<GrcControlProcess>,
    });
    if (existingLink) {
      throw new ConflictException(
        `Control ${controlId} is already linked to process ${processId}`,
      );
    }

    // Create the link
    const link = linkRepo.create({
      tenantId,
      controlId,
      processId,
    });
    await linkRepo.save(link);

    return {
      id: link.id,
      controlId,
      processId,
      tenantId,
      createdAt: link.createdAt,
    };
  }

  /**
   * DELETE /grc/controls/:controlId/processes/:processId
   * Unlink a control from a process
   */
  @Delete(':controlId/processes/:processId')
  @Permissions(Permission.GRC_CONTROL_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async unlinkProcess(
    @Headers('x-tenant-id') tenantId: string,
    @Param('controlId', ParseUUIDPipe) controlId: string,
    @Param('processId', ParseUUIDPipe) processId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const linkRepo = this.dataSource.getRepository(GrcControlProcess);

    // Find the link
    const link = await linkRepo.findOne({
      where: {
        controlId,
        processId,
        tenantId,
      } as FindOptionsWhere<GrcControlProcess>,
    });
    if (!link) {
      throw new NotFoundException(
        `Link between control ${controlId} and process ${processId} not found`,
      );
    }

    // Delete the link
    await linkRepo.remove(link);
  }

  /**
   * GET /grc/controls/:controlId/processes
   * Get all processes linked to a control
   */
  @Get(':controlId/processes')
  @Permissions(Permission.GRC_CONTROL_READ)
  @Perf()
  async getLinkedProcesses(
    @Headers('x-tenant-id') tenantId: string,
    @Param('controlId', ParseUUIDPipe) controlId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const controlRepo = this.dataSource.getRepository(GrcControl);
    const linkRepo = this.dataSource.getRepository(GrcControlProcess);

    // Verify control exists and belongs to tenant
    const control = await controlRepo.findOne({
      where: {
        id: controlId,
        tenantId,
        isDeleted: false,
      } as FindOptionsWhere<GrcControl>,
    });
    if (!control) {
      throw new NotFoundException(`Control with ID ${controlId} not found`);
    }

    // Get all linked processes
    const links = await linkRepo.find({
      where: { controlId, tenantId } as FindOptionsWhere<GrcControlProcess>,
      relations: ['process'],
    });

    return links.map((link) => ({
      id: link.id,
      processId: link.processId,
      process: link.process,
      createdAt: link.createdAt,
    }));
  }

  /**
   * GET /grc/controls/:controlId/evidences
   * Get all evidence linked to a control
   */
  @Get(':controlId/evidences')
  @Permissions(Permission.GRC_CONTROL_READ)
  @Perf()
  async getLinkedEvidences(
    @Headers('x-tenant-id') tenantId: string,
    @Param('controlId', ParseUUIDPipe) controlId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const controlRepo = this.dataSource.getRepository(GrcControl);
    const linkRepo = this.dataSource.getRepository(GrcControlEvidence);

    // Verify control exists and belongs to tenant
    const control = await controlRepo.findOne({
      where: {
        id: controlId,
        tenantId,
        isDeleted: false,
      } as FindOptionsWhere<GrcControl>,
    });
    if (!control) {
      throw new NotFoundException(`Control with ID ${controlId} not found`);
    }

    // Get all linked evidence
    const links = await linkRepo.find({
      where: { controlId, tenantId } as FindOptionsWhere<GrcControlEvidence>,
      relations: ['evidence'],
      order: { createdAt: 'DESC' },
    });

    return links.map((link) => ({
      id: link.id,
      evidenceId: link.evidenceId,
      evidence: link.evidence,
      evidenceType: link.evidenceType,
      validFrom: link.validFrom,
      validUntil: link.validUntil,
      notes: link.notes,
      createdAt: link.createdAt,
    }));
  }
}
