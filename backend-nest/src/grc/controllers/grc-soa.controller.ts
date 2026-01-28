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
  UseGuards,
  BadRequestException,
  NotFoundException,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Res,
  Request,
} from '@nestjs/common';
import { UuidFormatPipe } from '../../common/pipes';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { Perf } from '../../common/decorators';
import { GrcSoaService } from '../services/grc-soa.service';
import { GrcIssueService } from '../services/grc-issue.service';
import { GrcCapaService } from '../services/grc-capa.service';
import {
  CreateSoaProfileDto,
  UpdateSoaProfileDto,
  FilterSoaProfileDto,
  UpdateSoaItemDto,
  FilterSoaItemDto,
} from '../dto';
import { CreateIssueFromSoaItemDto } from '../dto/issue.dto';
import { CreateCapaFromSoaItemDto } from '../dto/capa.dto';
import { SourceType } from '../enums';

/**
 * GRC SOA Controller
 *
 * Provides REST API endpoints for Statement of Applicability (SOA) management.
 * All endpoints require JWT authentication and tenant context.
 *
 * Endpoints:
 * - Profiles: CRUD operations for SOA profiles
 * - Items: List and update SOA items
 * - Linking: Link/unlink controls and evidence to items
 * - Export: CSV export for auditors
 */
@Controller('grc/soa')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GrcSoaController {
  constructor(
    private readonly soaService: GrcSoaService,
    private readonly issueService: GrcIssueService,
    private readonly capaService: GrcCapaService,
  ) {}

  // ============================================================================
  // Profile Endpoints
  // ============================================================================

  /**
   * GET /grc/soa/profiles
   * List all SOA profiles for the current tenant with pagination and filtering
   */
  @Get('profiles')
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
  async listProfiles(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: FilterSoaProfileDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.soaService.listProfiles(tenantId, filter);
  }

  /**
   * POST /grc/soa/profiles
   * Create a new SOA profile
   */
  @Post('profiles')
  @Permissions(Permission.GRC_REQUIREMENT_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createProfile(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateSoaProfileDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.soaService.createProfile(tenantId, req.user.id, dto);
  }

  /**
   * GET /grc/soa/profiles/:id
   * Get a specific SOA profile by ID
   */
  @Get('profiles/:id')
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
  async getProfile(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const profile = await this.soaService.getProfile(tenantId, id);
    if (!profile) {
      throw new NotFoundException(`SOA Profile with ID ${id} not found`);
    }

    return profile;
  }

  /**
   * PATCH /grc/soa/profiles/:id
   * Update an SOA profile
   */
  @Patch('profiles/:id')
  @Permissions(Permission.GRC_REQUIREMENT_WRITE)
  @Perf()
  async updateProfile(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSoaProfileDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const profile = await this.soaService.updateProfile(
      tenantId,
      req.user.id,
      id,
      dto,
    );
    if (!profile) {
      throw new NotFoundException(`SOA Profile with ID ${id} not found`);
    }

    return profile;
  }

  /**
   * DELETE /grc/soa/profiles/:id
   * Soft delete an SOA profile
   */
  @Delete('profiles/:id')
  @Permissions(Permission.GRC_REQUIREMENT_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async deleteProfile(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const deleted = await this.soaService.deleteProfile(
      tenantId,
      req.user.id,
      id,
    );
    if (!deleted) {
      throw new NotFoundException(`SOA Profile with ID ${id} not found`);
    }
  }

  /**
   * POST /grc/soa/profiles/:id/publish
   * Publish an SOA profile (sets status to PUBLISHED)
   */
  @Post('profiles/:id/publish')
  @Permissions(Permission.GRC_REQUIREMENT_WRITE)
  @Perf()
  async publishProfile(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const profile = await this.soaService.publishProfile(
      tenantId,
      req.user.id,
      id,
    );
    if (!profile) {
      throw new NotFoundException(`SOA Profile with ID ${id} not found`);
    }

    return profile;
  }

  /**
   * POST /grc/soa/profiles/:id/initialize-items
   * Initialize SOA items for all clauses of the profile's standard
   * Idempotent - skips existing items
   */
  @Post('profiles/:id/initialize-items')
  @Permissions(Permission.GRC_REQUIREMENT_WRITE)
  @Perf()
  async initializeItems(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.soaService.initializeItems(tenantId, req.user.id, id);
  }

  /**
   * GET /grc/soa/profiles/:profileId/items
   * List SOA items for a specific profile with pagination and filtering
   * Returns LIST-CONTRACT format: { data: { items, total, page, pageSize, totalPages } }
   */
  @Get('profiles/:profileId/items')
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
  async listProfileItems(
    @Headers('x-tenant-id') tenantId: string,
    @Param('profileId', UuidFormatPipe) profileId: string,
    @Query() filter: FilterSoaItemDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const profile = await this.soaService.getProfile(tenantId, profileId);
    if (!profile) {
      throw new NotFoundException(`SOA Profile with ID ${profileId} not found`);
    }

    filter.profileId = profileId;
    const result = await this.soaService.listItems(tenantId, filter);
    return { success: true, data: result };
  }

  /**
   * GET /grc/soa/profiles/:profileId/statistics
   * Get aggregated statistics for an SOA profile
   * Returns counts by applicability, implementation status, and coverage metrics
   */
  @Get('profiles/:profileId/statistics')
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
  async getProfileStatistics(
    @Headers('x-tenant-id') tenantId: string,
    @Param('profileId', UuidFormatPipe) profileId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const stats = await this.soaService.getProfileStatistics(
      tenantId,
      profileId,
    );
    return { success: true, data: stats };
  }

  /**
   * GET /grc/soa/profiles/:id/export
   * Export SOA profile to CSV format
   */
  @Get('profiles/:id/export')
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
  async exportProfile(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('format') format: string = 'csv',
    @Res() res: Response,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    if (format !== 'csv') {
      throw new BadRequestException('Only CSV format is currently supported');
    }

    const csv = await this.soaService.exportCsv(tenantId, id);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="soa-profile-${id}.csv"`,
    );
    res.send(csv);
  }

  // ============================================================================
  // Item Endpoints
  // ============================================================================

  /**
   * GET /grc/soa/items
   * List SOA items with pagination and filtering
   * Requires profileId query parameter
   */
  @Get('items')
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
  async listItems(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: FilterSoaItemDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    if (!filter.profileId) {
      throw new BadRequestException('profileId query parameter is required');
    }

    return this.soaService.listItems(tenantId, filter);
  }

  /**
   * GET /grc/soa/items/:id
   * Get a specific SOA item by ID
   */
  @Get('items/:id')
  @Permissions(Permission.GRC_REQUIREMENT_READ)
  @Perf()
  async getItem(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const item = await this.soaService.getItem(tenantId, id);
    if (!item) {
      throw new NotFoundException(`SOA Item with ID ${id} not found`);
    }

    return item;
  }

  /**
   * PATCH /grc/soa/items/:id
   * Update an SOA item
   */
  @Patch('items/:id')
  @Permissions(Permission.GRC_REQUIREMENT_WRITE)
  @Perf()
  async updateItem(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSoaItemDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const item = await this.soaService.updateItem(
      tenantId,
      req.user.id,
      id,
      dto,
    );
    if (!item) {
      throw new NotFoundException(`SOA Item with ID ${id} not found`);
    }

    return item;
  }

  // ============================================================================
  // Control Linking Endpoints
  // ============================================================================

  /**
   * POST /grc/soa/items/:id/controls/:controlId
   * Link a control to an SOA item
   */
  @Post('items/:id/controls/:controlId')
  @Permissions(Permission.GRC_REQUIREMENT_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async linkControl(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('controlId', ParseUUIDPipe) controlId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.soaService.linkControl(tenantId, id, controlId);
  }

  /**
   * DELETE /grc/soa/items/:id/controls/:controlId
   * Unlink a control from an SOA item
   */
  @Delete('items/:id/controls/:controlId')
  @Permissions(Permission.GRC_REQUIREMENT_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async unlinkControl(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('controlId', ParseUUIDPipe) controlId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const unlinked = await this.soaService.unlinkControl(
      tenantId,
      id,
      controlId,
    );
    if (!unlinked) {
      throw new NotFoundException(
        `Link between SOA Item ${id} and Control ${controlId} not found`,
      );
    }
  }

  // ============================================================================
  // Evidence Linking Endpoints
  // ============================================================================

  /**
   * POST /grc/soa/items/:id/evidence/:evidenceId
   * Link evidence to an SOA item
   */
  @Post('items/:id/evidence/:evidenceId')
  @Permissions(Permission.GRC_REQUIREMENT_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async linkEvidence(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.soaService.linkEvidence(tenantId, id, evidenceId);
  }

  /**
   * DELETE /grc/soa/items/:id/evidence/:evidenceId
   * Unlink evidence from an SOA item
   */
  @Delete('items/:id/evidence/:evidenceId')
  @Permissions(Permission.GRC_REQUIREMENT_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async unlinkEvidence(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const unlinked = await this.soaService.unlinkEvidence(
      tenantId,
      id,
      evidenceId,
    );
    if (!unlinked) {
      throw new NotFoundException(
        `Link between SOA Item ${id} and Evidence ${evidenceId} not found`,
      );
    }
  }

  // ============================================================================
  // Issue/CAPA Linking Endpoints (SOA Closure Loop)
  // ============================================================================

  /**
   * GET /grc/soa/items/:id/issues
   * Get Issues created from this SOA item
   * Returns LIST-CONTRACT format with pagination
   */
  @Get('items/:id/issues')
  @Permissions(Permission.GRC_ISSUE_READ)
  @Perf()
  async getLinkedIssues(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', UuidFormatPipe) id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const item = await this.soaService.getItem(tenantId, id);
    if (!item) {
      throw new NotFoundException(`SOA Item with ID ${id} not found`);
    }

    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 5;

    const result = await this.issueService.findBySourceId(
      tenantId,
      SourceType.SOA_ITEM,
      id,
      pageNum,
      pageSizeNum,
    );

    return {
      success: true,
      data: {
        items: result.items,
        total: result.total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(result.total / pageSizeNum),
      },
    };
  }

  /**
   * POST /grc/soa/items/:id/issues
   * Create an Issue from this SOA item
   * Sets source fields to track origin
   */
  @Post('items/:id/issues')
  @Permissions(Permission.GRC_ISSUE_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createIssueFromItem(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id', UuidFormatPipe) id: string,
    @Body() dto: CreateIssueFromSoaItemDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const item = await this.soaService.getItem(tenantId, id);
    if (!item) {
      throw new NotFoundException(`SOA Item with ID ${id} not found`);
    }

    const clauseCode: string = item.clause?.code ?? 'Unknown';
    const clauseName: string = item.clause?.title ?? 'Unknown Clause';

    const issue = await this.issueService.createFromSoaItem(
      tenantId,
      id,
      clauseCode,
      clauseName,
      dto,
      req.user.id,
    );

    return { success: true, data: issue };
  }

  /**
   * GET /grc/soa/items/:id/capas
   * Get CAPAs created from this SOA item
   * Returns LIST-CONTRACT format with pagination
   */
  @Get('items/:id/capas')
  @Permissions(Permission.GRC_CAPA_READ)
  @Perf()
  async getLinkedCapas(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', UuidFormatPipe) id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const item = await this.soaService.getItem(tenantId, id);
    if (!item) {
      throw new NotFoundException(`SOA Item with ID ${id} not found`);
    }

    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 5;

    const result = await this.capaService.findBySourceId(
      tenantId,
      SourceType.SOA_ITEM,
      id,
      pageNum,
      pageSizeNum,
    );

    return {
      success: true,
      data: {
        items: result.items,
        total: result.total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(result.total / pageSizeNum),
      },
    };
  }

  /**
   * POST /grc/soa/items/:id/capas
   * Create a CAPA from this SOA item
   * Creates an Issue first if issueId not provided, then creates CAPA
   * Sets source fields to track origin
   */
  @Post('items/:id/capas')
  @Permissions(Permission.GRC_CAPA_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createCapaFromItem(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id', UuidFormatPipe) id: string,
    @Body() dto: CreateCapaFromSoaItemDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const item = await this.soaService.getItem(tenantId, id);
    if (!item) {
      throw new NotFoundException(`SOA Item with ID ${id} not found`);
    }

    const clauseCode: string = item.clause?.code ?? 'Unknown';
    const clauseName: string = item.clause?.title ?? 'Unknown Clause';

    let issueId = dto.issueId;

    if (!issueId) {
      const issue = await this.issueService.createFromSoaItem(
        tenantId,
        id,
        clauseCode,
        clauseName,
        {
          title: `SOA Gap: ${clauseCode} - ${clauseName}`,
          description: `Issue created for CAPA from SOA item gap. Clause: ${clauseCode}`,
        },
        req.user.id,
      );
      issueId = issue.id;
    }

    const capa = await this.capaService.createFromSoaItem(
      tenantId,
      issueId,
      id,
      clauseCode,
      dto,
      req.user.id,
    );

    return { success: true, data: capa };
  }
}
