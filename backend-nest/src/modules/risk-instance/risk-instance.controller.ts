import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { RiskInstanceService, QueryRiskInstanceDto } from './risk-instance.service';
import { CreateRiskInstanceDto, UpdateRiskInstanceDto } from './dto/create-risk-instance.dto';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import {
  EntityType,
  RiskStatus,
} from '../../entities/app/risk-instance.entity';
import { normalizeListParams, emptyList, asPaged } from '../../common/http/listing.util';
import { PagedListDto } from '../../common/http/paged.dto';
import { getTenantId } from '../../common/tenant/tenant.util';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Req } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';

@ApiTags('risk-instance')
@ApiBearerAuth()
@Controller({ path: 'risk-instances', version: '2' })
@UseGuards(TenantGuard)
export class RiskInstanceController {
  constructor(
    private readonly service: RiskInstanceService,
    private readonly config: ConfigService,
  ) {}

  @Get('ping')
  @ApiOperation({ summary: 'Risk instances ping' })
  @ApiOkResponse({ description: 'Ping response' })
  ping() {
    return { ok: true, mod: 'risk-instances', ts: new Date().toISOString() };
  }

  @Get()
  @ApiOperation({
    summary: 'List risk instances',
    description:
      'Get paginated list of risk instances with calculated residual risk scores',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'Text search' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sort', required: false, type: String, description: 'Sort: "column:direction"' })
  @ApiQuery({ name: 'status', required: false, enum: RiskStatus })
  @ApiQuery({ name: 'catalog_id', required: false, type: String })
  @ApiQuery({ name: 'entity_id', required: false, type: String })
  @ApiQuery({ name: 'entity_type', required: false, enum: EntityType })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'owner_id', required: false, type: String })
  @ApiQuery({ name: 'score_min', required: false, type: Number })
  @ApiQuery({ name: 'score_max', required: false, type: Number })
  @ApiOkResponse({
    description: 'List of risk instances',
    type: PagedListDto,
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: { $ref: '#/components/schemas/RiskInstanceEntity' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        pageSize: { type: 'number' },
      },
    },
  })
  async list(@Query() query: QueryRiskInstanceDto, @Req() req: Request): Promise<PagedListDto<any>> {
    const tenantId = getTenantId(req, this.config);
    const { page, pageSize } = normalizeListParams(query);
    try {
      const result = await this.service.list(tenantId, query);
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
      return emptyList(page, pageSize) as PagedListDto<any>;
    } catch (error: any) {
      // Defensive: return empty list on error (never 404)
      return emptyList(page, pageSize) as PagedListDto<any>;
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get risk instance',
    description:
      'Get single risk instance with calculated scores and control details',
  })
  @ApiOkResponse({ description: 'Risk instance details' })
  @ApiParam({ name: 'id', description: 'Risk instance ID' })
  async getOne(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.service.getOne(id, tenantId);
  }

  @Post()
  @ApiOperation({
    summary: 'Create risk instance',
    description:
      'Create a new risk instance for an entity (residual risk calculated automatically)',
  })
  @ApiCreatedResponse({ description: 'Created risk instance' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateRiskInstanceDto, @Tenant() tenantId: string) {
    return this.service.create(tenantId, dto);
  }

  @Put(':id')
  @Patch(':id')
  @ApiOperation({
    summary: 'Update risk instance',
    description:
      'Update risk instance (recalculates scores if likelihood/impact change, supports full lifecycle)',
  })
  @ApiOkResponse({ description: 'Updated risk instance' })
  @ApiParam({ name: 'id', description: 'Risk instance ID' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRiskInstanceDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.update(id, tenantId, dto);
  }

  @Post(':id/controls/:controlId/link')
  @ApiOperation({
    summary: 'Link control to risk instance',
    description:
      'Link a control to risk instance and recalculate residual risk',
  })
  @ApiOkResponse({ description: 'Control linked, residual risk recalculated' })
  @ApiParam({ name: 'id', description: 'Risk instance ID' })
  @ApiParam({ name: 'controlId', description: 'Control ID to link' })
  @HttpCode(HttpStatus.OK)
  async linkControl(
    @Param('id') instanceId: string,
    @Param('controlId') controlId: string,
    @Tenant() tenantId: string,
  ) {
    return this.service.linkControl(instanceId, controlId, tenantId);
  }

  @Delete(':id/controls/:controlId/unlink')
  @ApiOperation({
    summary: 'Unlink control from risk instance',
    description: 'Remove control link and recalculate residual risk',
  })
  @ApiOkResponse({
    description: 'Control unlinked, residual risk recalculated',
  })
  @ApiParam({ name: 'id', description: 'Risk instance ID' })
  @ApiParam({ name: 'controlId', description: 'Control ID to unlink' })
  @HttpCode(HttpStatus.OK)
  async unlinkControl(
    @Param('id') instanceId: string,
    @Param('controlId') controlId: string,
    @Tenant() tenantId: string,
  ) {
    return this.service.unlinkControl(instanceId, controlId, tenantId);
  }
}
