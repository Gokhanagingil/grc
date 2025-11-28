import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataFoundationService } from './data-foundation.service';
import { QueryStandardDto } from './dto/query-standard.dto';
import { QueryControlDto } from './dto/query-control.dto';
import { QueryRiskCatalogDto } from './dto/query-risk-catalog.dto';
import { CrossImpactQueryDto } from './dto/cross-impact-query.dto';
import { CreateFindingDto } from './dto/create-finding.dto';
import { CreateRiskCatalogDto } from './dto/create-risk-catalog.dto';
import { CreateClauseDto } from './dto/create-clause.dto';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RiskCategoryEntity } from '../../entities/app/risk-category.entity';
import { tenantWhere } from '../../common/tenant/tenant-query.util';
import { AutoGenerationService } from '../risk-instance/auto-generation.service';

@ApiTags('data-foundation')
@ApiBearerAuth()
@Controller({ path: '', version: '2' })
@UseGuards(TenantGuard)
export class DataFoundationController {
  constructor(
    private readonly service: DataFoundationService,
    @InjectRepository(RiskCategoryEntity)
    private readonly categoryRepo: Repository<RiskCategoryEntity>,
    private readonly autoGenerationService: AutoGenerationService,
  ) {}

  @Get('ping')
  @ApiOperation({ summary: 'Data foundation ping' })
  @ApiOkResponse({ description: 'Ping response' })
  ping() {
    return { ok: true, mod: 'data-foundation', ts: new Date().toISOString() };
  }

  @Get('standards')
  @ApiOperation({
    summary: 'List standards',
    description: 'Get list of standards with optional code filter',
  })
  @ApiOkResponse({ description: 'List of standards' })
  async getStandards(
    @Query() query: QueryStandardDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.findStandards(tenantId, query.code);
  }

  @Get('standards/:code/clauses')
  @ApiOperation({
    summary: 'Get standard clauses tree',
    description: 'Get hierarchical tree of clauses for a standard',
  })
  @ApiOkResponse({ description: 'Hierarchical tree of clauses' })
  async getStandardClauses(
    @Param('code') code: string,
    @Tenant() tenantId: string,
    @Query('includeSynthetic') includeSynthetic?: string,
  ) {
    const includeSyntheticBool =
      includeSynthetic === 'true' || includeSynthetic === undefined
        ? undefined
        : includeSynthetic === 'false'
          ? false
          : undefined;
    return this.service.findStandardClauses(
      tenantId,
      code,
      includeSyntheticBool,
    );
  }

  @Get('controls')
  @ApiOperation({
    summary: 'List controls',
    description: 'Get list of controls with optional family and search filters',
  })
  @ApiOkResponse({ description: 'List of controls' })
  async getControls(
    @Query() query: QueryControlDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.findControls(tenantId, query.family, query.search);
  }

  @Get('controls/:id')
  @ApiOperation({
    summary: 'Get control details',
    description: 'Get control with all relationships (clauses, policies, risks, findings, CAPs)',
  })
  @ApiOkResponse({ description: 'Control details with relationships' })
  async getControl(
    @Param('id') id: string,
    @Tenant() tenantId: string,
  ) {
    return this.service.getOneControl(id, tenantId);
  }

  @Get('risk-catalog')
  @ApiOperation({
    summary: 'List risk catalog',
    description:
      'Get list of risks from catalog with KQL search, pagination, sort, and filters',
  })
  @ApiOkResponse({ description: 'List of risk catalog entries' })
  async getRiskCatalog(
    @Query() query: QueryRiskCatalogDto,
    @Tenant() tenantId: string,
  ) {
    try {
      return await this.service.findRiskCatalog(tenantId, query);
    } catch (error: any) {
      // Defensive: always return 200 with empty array on errors
      return {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        note: 'Error loading risk catalog',
      };
    }
  }

  @Get('compliance/cross-impact')
  @ApiOperation({
    summary: 'Get cross-impact for clause',
    description: 'Find related clauses across standards for a given clause',
  })
  @ApiOkResponse({ description: 'Cross-impact analysis result' })
  async getCrossImpact(
    @Query() query: CrossImpactQueryDto,
    @Tenant() tenantId: string,
    @Query('includeSynthetic') includeSynthetic?: string,
  ) {
    try {
      const includeSyntheticBool =
        includeSynthetic === 'true' || includeSynthetic === undefined
          ? undefined
          : includeSynthetic === 'false'
            ? false
            : undefined;
      const clauseCode = query.clause || '';
      return await this.service.findCrossImpact(
        tenantId,
        clauseCode,
        includeSyntheticBool,
      );
    } catch (error: any) {
      // Always return 200, even on validation errors
      return {
        clause: query.clause || '',
        matches: [],
        note: 'invalid_clause_format',
      };
    }
  }

  @Post('audit/findings')
  @ApiOperation({
    summary: 'Create audit finding',
    description: 'Create a new audit finding with cross-impact analysis',
  })
  @ApiOkResponse({ description: 'Created finding with cross-impact' })
  async createFinding(
    @Body() dto: CreateFindingDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.createFinding(tenantId, dto);
  }

  @Post('risk-catalog')
  @ApiOperation({
    summary: 'Create risk in catalog',
    description: 'Create a new risk entry in the risk catalog',
  })
  @ApiCreatedResponse({ description: 'Created risk catalog entry' })
  @HttpCode(HttpStatus.CREATED)
  async createRiskCatalog(
    @Body() dto: CreateRiskCatalogDto,
    @Tenant() tenantId: string,
  ) {
    try {
      return await this.service.createRiskCatalog(tenantId, dto);
    } catch (error: any) {
      throw error;
    }
  }

  @Post('standards/:code/clauses')
  @ApiOperation({
    summary: 'Create new clause for standard',
    description: 'Create a new clause (requirement) for a standard',
  })
  @ApiCreatedResponse({ description: 'Created clause' })
  @HttpCode(HttpStatus.CREATED)
  async createClause(
    @Param('code') code: string,
    @Body() dto: CreateClauseDto,
    @Tenant() tenantId: string,
  ) {
    try {
      return await this.service.createClause(tenantId, code, dto);
    } catch (error: any) {
      throw error;
    }
  }

  @Get('risk-catalog/categories')
  @ApiOperation({
    summary: 'List risk categories',
    description: 'Get list of available risk categories for choice lists',
  })
  @ApiOkResponse({ description: 'List of risk categories' })
  async getRiskCategories(@Tenant() tenantId: string) {
    try {
      const categories = await this.categoryRepo.find({
        where: { ...tenantWhere(tenantId) },
        order: { name: 'ASC' },
      });
      return categories;
    } catch (error: any) {
      // Return empty array on error
      return [];
    }
  }

  @Post('risk-catalog/:id/auto-generate')
  @ApiOperation({
    summary: 'Auto-generate risk instances',
    description:
      'Generate risk instances for all entities matching catalog filter',
  })
  @ApiOkResponse({ description: 'Auto-generation result' })
  async autoGenerateInstances(
    @Param('id') catalogId: string,
    @Tenant() tenantId: string,
  ) {
    return this.autoGenerationService.generateInstances(catalogId, tenantId);
  }
}
