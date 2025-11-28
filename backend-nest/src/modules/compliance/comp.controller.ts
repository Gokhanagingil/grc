import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags, ApiCreatedResponse } from '@nestjs/swagger';
import { ComplianceService } from './comp.service';
import {
  CreateRequirementDto,
  UpdateRequirementDto,
  QueryRequirementDto,
} from './comp.dto';
import { normalizeListParams, emptyList, asPaged } from '../../common/http/listing.util';
import { PagedListDto } from '../../common/http/paged.dto';
import { RequirementEntity } from './comp.entity';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { getTenantId } from '../../common/tenant/tenant.util';
import { ConfigService } from '@nestjs/config';
import { ApiQuery } from '@nestjs/swagger';

@ApiTags('compliance')
@Controller({ path: 'compliance', version: '2' })
@UseGuards(TenantGuard)
export class ComplianceController {
  constructor(
    private readonly service: ComplianceService,
    private readonly config: ConfigService,
  ) {}

  @Get('ping')
  @ApiOkResponse({ description: 'Compliance ping' })
  ping() {
    return { ok: true, mod: 'compliance', ts: new Date().toISOString() };
  }

  @Get('requirements')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'Text search in title' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sort', required: false, type: String, description: 'Sort: "column:direction"' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'regulation', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiOkResponse({
    description: 'List of requirements with paging',
    type: PagedListDto,
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: { $ref: '#/components/schemas/RequirementEntity' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        pageSize: { type: 'number' },
      },
    },
  })
  async list(@Query() q: QueryRequirementDto, @Req() req: Request): Promise<PagedListDto<RequirementEntity>> {
    const tenantId = getTenantId(req, this.config);
    const { page, pageSize } = normalizeListParams(q);
    try {
      const result = await this.service.list(q, tenantId);
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
      return emptyList(page, pageSize) as PagedListDto<RequirementEntity>;
    } catch (error: any) {
      // Defensive: return empty list on error (never 404)
      return emptyList(page, pageSize) as PagedListDto<RequirementEntity>;
    }
  }

  @Get(':id')
  get(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.service.get(id, tenantId);
  }

  @Post()
  @ApiCreatedResponse({
    description: 'Create new requirement',
    type: RequirementEntity,
  })
  create(@Body() dto: CreateRequirementDto, @Tenant() tenantId: string) {
    return this.service.create(dto, tenantId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRequirementDto, @Tenant() tenantId: string) {
    return this.service.update(id, dto, tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.service.remove(id, tenantId);
  }
}
