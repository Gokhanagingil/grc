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
import { GrcControl } from '../entities/grc-control.entity';
import { Perf } from '../../common/decorators';

/**
 * GRC Control Controller
 *
 * Provides list and read endpoints for GRC Controls.
 * All endpoints require JWT authentication and tenant context.
 * Read operations require GRC_CONTROL_READ permission.
 */
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

  constructor(private readonly dataSource: DataSource) {}

  /**
   * GET /grc/controls
   * List all controls for the current tenant with pagination and filtering
   */
  @Get()
  @Permissions(Permission.GRC_CONTROL_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('sortBy') sortBy = 'createdAt',
    @Query('sortOrder') sortOrder: 'ASC' | 'DESC' = 'DESC',
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('q') search?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const controlRepo = this.dataSource.getRepository(GrcControl);
    const queryBuilder = controlRepo
      .createQueryBuilder('control')
      .leftJoinAndSelect('control.owner', 'owner')
      .where('control.tenantId = :tenantId', { tenantId })
      .andWhere('control.isDeleted = :isDeleted', { isDeleted: false });

    if (status) {
      queryBuilder.andWhere('control.status = :status', { status });
    }

    if (type) {
      queryBuilder.andWhere('control.type = :type', { type });
    }

    if (search) {
      queryBuilder.andWhere(
        '(control.name ILIKE :search OR control.code ILIKE :search OR control.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const safeSortBy = this.allowedSortFields.has(sortBy)
      ? sortBy
      : 'createdAt';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const [items, total] = await queryBuilder
      .orderBy(`control.${safeSortBy}`, safeSortOrder)
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
   * GET /grc/controls/:id
   * Get a specific control by ID
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
      ],
    });

    if (!control) {
      throw new NotFoundException(`Control with ID ${id} not found`);
    }

    return control;
  }
}
