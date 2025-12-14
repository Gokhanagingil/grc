import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Headers,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { DataSource } from 'typeorm';
import { Standard } from '../entities/standard.entity';
import { Perf } from '../../common/decorators';

/**
 * Standard Controller
 *
 * Provides endpoints for managing standards in the Standards Library.
 * All endpoints require JWT authentication and tenant context.
 * Write operations require GRC_AUDIT_WRITE permission.
 */
@Controller('grc/standards')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class StandardController {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * GET /grc/standards
   * List all standards for the current tenant
   */
  @Get()
  @Permissions(Permission.GRC_AUDIT_READ)
  @Perf()
  async findAll(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const standardRepo = this.dataSource.getRepository(Standard);
    const standards = await standardRepo.find({
      where: {
        tenantId,
        isDeleted: false,
      },
      order: {
        code: 'ASC',
        createdAt: 'DESC',
      },
    });

    return {
      success: true,
      data: standards,
      meta: {
        total: standards.length,
      },
    };
  }

  /**
   * POST /grc/standards
   * Create a new standard
   * Requires GRC_AUDIT_WRITE permission
   */
  @Post()
  @Permissions(Permission.GRC_AUDIT_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Body()
    body: {
      code: string;
      name: string;
      version?: string;
      domain?: string;
      description?: string;
      publisher?: string;
      publishedDate?: string;
    },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    if (!body.code || !body.name) {
      throw new BadRequestException('code and name are required');
    }

    const standardRepo = this.dataSource.getRepository(Standard);

    // Check if standard with same code/version already exists
    const existing = await standardRepo.findOne({
      where: {
        tenantId,
        code: body.code,
        version: body.version || null,
        isDeleted: false,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Standard with code ${body.code} and version ${body.version || 'null'} already exists`,
      );
    }

    const standard = standardRepo.create({
      tenantId,
      code: body.code,
      name: body.name,
      version: body.version || null,
      domain: body.domain || null,
      description: body.description || null,
      publisher: body.publisher || null,
      publishedDate: body.publishedDate
        ? new Date(body.publishedDate)
        : null,
    });

    await standardRepo.save(standard);

    return {
      success: true,
      data: standard,
    };
  }
}
