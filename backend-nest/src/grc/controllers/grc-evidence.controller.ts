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
import { GrcEvidence } from '../entities/grc-evidence.entity';
import { Perf } from '../../common/decorators';

/**
 * GRC Evidence Controller
 *
 * Provides list and read endpoints for GRC Evidence.
 * All endpoints require JWT authentication and tenant context.
 * Read operations require GRC_EVIDENCE_READ permission.
 */
@Controller('api/grc/evidence')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GrcEvidenceController {
  private readonly allowedSortFields: Set<string> = new Set([
    'createdAt',
    'updatedAt',
    'name',
    'type',
    'collectedAt',
    'expiresAt',
  ]);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * GET /api/grc/evidence
   * List all evidence for the current tenant with pagination and filtering
   */
  @Get()
  @Permissions(Permission.GRC_EVIDENCE_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('sortBy') sortBy = 'createdAt',
    @Query('sortOrder') sortOrder: 'ASC' | 'DESC' = 'DESC',
    @Query('type') type?: string,
    @Query('q') search?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const evidenceRepo = this.dataSource.getRepository(GrcEvidence);
    const queryBuilder = evidenceRepo
      .createQueryBuilder('evidence')
      .leftJoinAndSelect('evidence.collectedBy', 'collectedBy')
      .where('evidence.tenantId = :tenantId', { tenantId })
      .andWhere('evidence.isDeleted = :isDeleted', { isDeleted: false });

    if (type) {
      queryBuilder.andWhere('evidence.type = :type', { type });
    }

    if (search) {
      queryBuilder.andWhere(
        '(evidence.name ILIKE :search OR evidence.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const safeSortBy = this.allowedSortFields.has(sortBy)
      ? sortBy
      : 'createdAt';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const [items, total] = await queryBuilder
      .orderBy(`evidence.${safeSortBy}`, safeSortOrder)
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
   * GET /api/grc/evidence/:id
   * Get a specific evidence by ID
   */
  @Get(':id')
  @Permissions(Permission.GRC_EVIDENCE_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const evidenceRepo = this.dataSource.getRepository(GrcEvidence);
    const evidence = await evidenceRepo.findOne({
      where: {
        id,
        tenantId,
        isDeleted: false,
      } as FindOptionsWhere<GrcEvidence>,
      relations: ['collectedBy', 'issueEvidence', 'controlEvidence'],
    });

    if (!evidence) {
      throw new NotFoundException(`Evidence with ID ${id} not found`);
    }

    return evidence;
  }
}
