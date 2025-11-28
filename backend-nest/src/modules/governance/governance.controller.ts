import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { GovernanceService } from './governance.service';
import { CreateGovernancePolicyDto } from './dto/create-policy.dto';
import { UpdateGovernancePolicyDto } from './dto/update-policy.dto';
import { QueryPolicyDto } from './dto/query-policy.dto';
import { AddPolicyStandardDto } from './dto/policy-standard.dto';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { normalizeListParams, emptyList, asPaged } from '../../common/http/listing.util';
import { PagedListDto } from '../../common/http/paged.dto';
import { PolicyEntity } from '../../entities/app/policy.entity';
import { getTenantId } from '../../common/tenant/tenant.util';
import { ApiQuery } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

@ApiTags('governance')
@ApiBearerAuth()
@Controller({ path: 'governance', version: '2' })
@UseGuards(TenantGuard)
export class GovernanceController {
  constructor(
    private readonly service: GovernanceService,
    private readonly config: ConfigService,
  ) {}

  @Get('ping')
  @ApiOperation({ summary: 'Governance ping' })
  @ApiOkResponse({ description: 'Ping response' })
  ping() {
    return { ok: true, mod: 'governance', ts: new Date().toISOString() };
  }

  @Get('policies')
  @ApiOperation({
    summary: 'List policies',
    description: 'Get list of policies with filtering, sorting, and pagination',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Items per page (1-200)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Alias for pageSize' })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'Text search in title' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Alias for q' })
  @ApiQuery({ name: 'sort', required: false, type: String, description: 'Sort: "column:direction" (e.g., "created_at:desc", "title:asc")' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status' })
  @ApiOkResponse({
    description: 'List of policies with pagination',
    type: PagedListDto,
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: { $ref: '#/components/schemas/PolicyEntity' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        pageSize: { type: 'number' },
      },
    },
  })
  async list(@Query() query: QueryPolicyDto, @Req() req: Request): Promise<PagedListDto<PolicyEntity>> {
    const tenantId = getTenantId(req, this.config);
    const { page, pageSize } = normalizeListParams(query);
    try {
      const result = await this.service.list(query, tenantId);
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
      return emptyList(page, pageSize) as PagedListDto<PolicyEntity>;
    } catch (error: any) {
      // Defensive: return empty list on error (never 404)
      return emptyList(page, pageSize) as PagedListDto<PolicyEntity>;
    }
  }

  @Get('policies/:id')
  @ApiOperation({
    summary: 'Get policy by ID',
    description: 'Get policy details',
  })
  @ApiOkResponse({ type: PolicyEntity, description: 'Policy details' })
  async getOne(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.service.getOne(id, tenantId);
  }

  @Post('policies')
  @ApiOperation({
    summary: 'Create new policy',
    description: 'Create a new governance policy',
  })
  @ApiCreatedResponse({ type: PolicyEntity, description: 'Created policy' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateGovernancePolicyDto, @Tenant() tenantId: string) {
    return this.service.create(dto, tenantId);
  }

  @Put('policies/:id')
  @ApiOperation({
    summary: 'Update policy',
    description: 'Update an existing policy (full update)',
  })
  @ApiOkResponse({ type: PolicyEntity, description: 'Updated policy' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateGovernancePolicyDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.update(id, dto, tenantId);
  }

  @Patch('policies/:id')
  @ApiOperation({
    summary: 'Partially update policy',
    description: 'Partially update an existing policy (PATCH)',
  })
  @ApiOkResponse({ type: PolicyEntity, description: 'Updated policy' })
  async patch(
    @Param('id') id: string,
    @Body() dto: UpdateGovernancePolicyDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.update(id, dto, tenantId);
  }

  @Delete('policies/:id')
  @ApiOperation({
    summary: 'Delete policy',
    description: 'Permanently delete a policy',
  })
  @ApiOkResponse({ description: 'Policy deleted successfully' })
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.service.remove(id, tenantId);
  }

  // Policy-Standard Mapping
  @Get('policies/:id/standards')
  @ApiOperation({
    summary: 'Get standards mapped to policy',
    description: 'Get list of standards mapped to a policy',
  })
  @ApiOkResponse({ description: 'List of policy-standard mappings' })
  async getPolicyStandards(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.service.getPolicyStandards(id, tenantId);
  }

  @Post('policies/:id/standards')
  @ApiOperation({
    summary: 'Map standard to policy',
    description: 'Add a standard mapping to a policy',
  })
  @ApiCreatedResponse({ description: 'Standard mapped to policy successfully' })
  @HttpCode(HttpStatus.CREATED)
  async addPolicyStandard(
    @Param('id') id: string,
    @Body() dto: AddPolicyStandardDto,
    @Tenant() tenantId: string,
  ) {
    return this.service.addPolicyStandard(id, dto.standardId, tenantId);
  }

  @Delete('policies/:id/standards/:standardId')
  @ApiOperation({
    summary: 'Remove standard mapping from policy',
    description: 'Remove a standard mapping from a policy',
  })
  @ApiOkResponse({ description: 'Standard mapping removed successfully' })
  @HttpCode(HttpStatus.OK)
  async removePolicyStandard(
    @Param('id') id: string,
    @Param('standardId') standardId: string,
    @Tenant() tenantId: string,
  ) {
    return this.service.removePolicyStandard(id, standardId, tenantId);
  }
}
