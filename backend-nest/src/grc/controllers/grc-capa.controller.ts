import {
  Controller,
  Get,
  Param,
  Query,
  Headers,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { DataSource, FindOptionsWhere } from 'typeorm';
import { GrcCapa } from '../entities/grc-capa.entity';
import { Perf } from '../../common/decorators';

/**
 * GRC CAPA Controller
 *
 * Provides list and read endpoints for GRC CAPAs (Corrective and Preventive Actions).
 * All endpoints require JWT authentication and tenant context.
 * Read operations require GRC_CAPA_READ permission.
 */
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

  constructor(private readonly dataSource: DataSource) {}

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
}
