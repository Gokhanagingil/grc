import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiCreatedResponse, ApiQuery } from '@nestjs/swagger';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { DataFoundationService } from '../data-foundation/data-foundation.service';
import { QueryRiskCatalogDto } from '../data-foundation/dto/query-risk-catalog.dto';
import { CreateRiskCatalogDto, UpdateRiskCatalogDto } from '../data-foundation/dto/create-risk-catalog.dto';
import { normalizeListParams, emptyList, asPaged } from '../../common/http/listing.util';
import { PagedListDto } from '../../common/http/paged.dto';
import { RiskCatalogEntity } from '../../entities/app/risk-catalog.entity';
import { getTenantId } from '../../common/tenant/tenant.util';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Req } from '@nestjs/common';

@ApiTags('risk-catalog')
@ApiBearerAuth()
@Controller({ path: 'risk-catalog', version: '2' })
@UseGuards(TenantGuard)
export class RiskCatalogController {
  constructor(
    private readonly dataFoundationService: DataFoundationService,
    private readonly config: ConfigService,
  ) {}

  @Get('ping')
  @ApiOperation({ summary: 'Risk catalog ping' })
  @ApiOkResponse({ description: 'Ping response' })
  ping() {
    return { ok: true, mod: 'risk-catalog', ts: new Date().toISOString() };
  }

  @Get()
  @ApiOperation({
    summary: 'List risk catalog',
    description: 'Get paginated list of risk catalog entries with filters',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'KQL query or text search' })
  @ApiQuery({ name: 'sort', required: false, type: String, description: 'Sort: "column:direction"' })
  @ApiOkResponse({
    description: 'List of risk catalog entries',
    type: PagedListDto,
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: { $ref: '#/components/schemas/RiskCatalogEntity' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        pageSize: { type: 'number' },
      },
    },
  })
  async list(
    @Query() query: QueryRiskCatalogDto,
    @Req() req: Request,
  ): Promise<PagedListDto<RiskCatalogEntity>> {
    const tenantId = getTenantId(req, this.config);
    const { page, pageSize } = normalizeListParams(query);
    try {
      const result = await this.dataFoundationService.findRiskCatalog(tenantId, query);
      // Ensure result matches contract
      if (result && typeof result === 'object' && 'items' in result) {
        const resultLimit = (result as any).limit ?? (result as any).pageSize ?? pageSize;
        return asPaged(
          result.items || [],
          result.total ?? 0,
          result.page ?? page,
          resultLimit,
        );
      }
      return emptyList(page, pageSize) as PagedListDto<RiskCatalogEntity>;
    } catch (error: any) {
      // Defensive: return empty list on error (never 404)
      return emptyList(page, pageSize) as PagedListDto<RiskCatalogEntity>;
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get risk catalog entry',
    description: 'Get single risk catalog entry with all details',
  })
  @ApiOkResponse({ description: 'Risk catalog entry details' })
  @ApiParam({ name: 'id', description: 'Risk catalog ID' })
  async getOne(@Param('id') id: string, @Tenant() tenantId: string) {
    try {
      const catalog = await this.dataFoundationService.getOneRiskCatalog(id, tenantId);
      return catalog;
    } catch (error: any) {
      throw error;
    }
  }

  @Post()
  @ApiOperation({
    summary: 'Create risk catalog entry',
    description: 'Create a new risk catalog entry with all required fields',
  })
  @ApiCreatedResponse({ description: 'Created risk catalog entry' })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateRiskCatalogDto,
    @Tenant() tenantId: string,
  ) {
    return this.dataFoundationService.createRiskCatalog(tenantId, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update risk catalog entry',
    description: 'Update an existing risk catalog entry (auto-calculates inherent_score)',
  })
  @ApiOkResponse({ description: 'Updated risk catalog entry' })
  @ApiParam({ name: 'id', description: 'Risk catalog ID' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRiskCatalogDto,
    @Tenant() tenantId: string,
  ) {
    return this.dataFoundationService.updateRiskCatalog(id, tenantId, dto);
  }
}
