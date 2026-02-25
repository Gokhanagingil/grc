import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { RiskAdvisoryService } from './risk-advisory.service';
import { AnalyzeRiskAdvisoryDto, CreateDraftsDto } from './dto/advisory.dto';

/**
 * Risk Advisory Controller
 *
 * Provides AI-ready, human-in-the-loop risk advisory endpoints.
 * Phase 1: Deterministic heuristics with explainable recommendations.
 *
 * Endpoints:
 *   POST /grc/risks/:id/advisory/analyze   - Generate advisory for a risk
 *   GET  /grc/risks/:id/advisory/latest     - Get latest advisory result
 *   POST /grc/risks/:id/advisory/create-drafts - Create draft records from advisory
 *
 * All endpoints require JWT auth + tenant context + GRC_RISK_READ/WRITE permissions.
 */
@Controller('grc/risks')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class RiskAdvisoryController {
  constructor(private readonly advisoryService: RiskAdvisoryService) {}

  /**
   * POST /grc/risks/:id/advisory/analyze
   *
   * Analyze a risk and generate advisory recommendations.
   * Uses deterministic heuristics (Phase 1) with AI-ready contract.
   */
  @Post(':id/advisory/analyze')
  @Permissions(Permission.GRC_RISK_READ)
  @HttpCode(HttpStatus.OK)
  async analyze(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') riskId: string,
    @Body() dto: AnalyzeRiskAdvisoryDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const advisory = await this.advisoryService.analyzeRisk(tenantId, riskId, {
      includeCmdbTopology: dto.includeCmdbTopology,
      includeLinkedEntities: dto.includeLinkedEntities,
    });

    return {
      success: true,
      data: advisory,
    };
  }

  /**
   * GET /grc/risks/:id/advisory/latest
   *
   * Return the latest advisory result for a risk.
   * Returns 404 if no advisory has been generated yet.
   */
  @Get(':id/advisory/latest')
  @Permissions(Permission.GRC_RISK_READ)
  async getLatest(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') riskId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const advisory = await this.advisoryService.getLatestAdvisory(
      tenantId,
      riskId,
    );

    if (!advisory) {
      throw new NotFoundException(
        'No advisory found for this risk. Run analyze first.',
      );
    }

    return {
      success: true,
      data: advisory,
    };
  }

  /**
   * POST /grc/risks/:id/advisory/create-drafts
   *
   * Create draft records from selected advisory suggestions.
   * Human-in-the-loop: requires explicit selection of items to create.
   */
  @Post(':id/advisory/create-drafts')
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.OK)
  async createDrafts(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') riskId: string,
    @Body() dto: CreateDraftsDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    if (!dto.selectedItems || dto.selectedItems.length === 0) {
      throw new BadRequestException('At least one item must be selected');
    }

    const result = await this.advisoryService.createDrafts(
      tenantId,
      riskId,
      req.user.id,
      dto,
    );

    return {
      success: true,
      data: result,
    };
  }
}
