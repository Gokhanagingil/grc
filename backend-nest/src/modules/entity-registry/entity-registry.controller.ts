import {
  Controller,
  Get,
  Post,
  Put,
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
import { EntityTypeService } from './entity-type.service';
import { EntityService } from './entity.service';
import { CreateEntityTypeDto } from './dto/create-entity-type.dto';
import { CreateEntityDto } from './dto/create-entity.dto';
import { QueryEntityDto } from './dto/query-entity.dto';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { normalizeListParams, emptyList, asPaged } from '../../common/http/listing.util';
import { PagedListDto } from '../../common/http/paged.dto';
import { EntityTypeEntity } from '../../entities/app/entity-type.entity';
import { getTenantId } from '../../common/tenant/tenant.util';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Req } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';

@ApiTags('entity-registry')
@ApiBearerAuth()
@Controller({ path: 'entity-registry', version: '2' })
@UseGuards(TenantGuard)
export class EntityRegistryController {
  constructor(
    private readonly entityTypeService: EntityTypeService,
    private readonly entityService: EntityService,
    private readonly config: ConfigService,
  ) {}

  @Get('ping')
  @ApiOperation({ summary: 'Entity registry ping' })
  @ApiOkResponse({ description: 'Ping response' })
  ping() {
    return { ok: true, mod: 'entity-registry', ts: new Date().toISOString() };
  }

  // Entity Types endpoints
  @Get('entity-types')
  @ApiOperation({
    summary: 'List entity types',
    description: 'Get paginated list of entity types',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'Text search in name' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sort', required: false, type: String, description: 'Sort: "column:direction"' })
  @ApiOkResponse({
    description: 'List of entity types',
    type: PagedListDto,
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: { $ref: '#/components/schemas/EntityTypeEntity' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        pageSize: { type: 'number' },
      },
    },
  })
  async listEntityTypes(
    @Query()
    query: {
      page?: string;
      pageSize?: string;
      limit?: string;
      search?: string;
      q?: string;
      sort?: string;
      dir?: string;
    },
    @Req() req: Request,
  ): Promise<PagedListDto<EntityTypeEntity>> {
    const tenantId = getTenantId(req, this.config);
    const { page, pageSize } = normalizeListParams(query);
    try {
      const result = await this.entityTypeService.list(tenantId, query);
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
      return emptyList(page, pageSize) as PagedListDto<EntityTypeEntity>;
    } catch (error: any) {
      // Defensive: return empty list on error (never 404)
      return emptyList(page, pageSize) as PagedListDto<EntityTypeEntity>;
    }
  }

  @Get('entity-types/choices')
  @ApiOperation({
    summary: 'Get entity type choices',
    description: 'Get simplified list for dropdowns',
  })
  @ApiOkResponse({ description: 'List of entity type choices' })
  async getEntityTypeChoices(@Tenant() tenantId: string) {
    return this.entityTypeService.getChoices(tenantId);
  }

  @Get('entity-types/:id')
  @ApiOperation({
    summary: 'Get entity type',
    description: 'Get single entity type by ID',
  })
  @ApiOkResponse({ description: 'Entity type details' })
  @ApiParam({ name: 'id', description: 'Entity type ID' })
  async getEntityType(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.entityTypeService.getOne(id, tenantId);
  }

  @Post('entity-types')
  @ApiOperation({
    summary: 'Create entity type',
    description: 'Create a new entity type',
  })
  @ApiCreatedResponse({ description: 'Created entity type' })
  @HttpCode(HttpStatus.CREATED)
  async createEntityType(
    @Body() dto: CreateEntityTypeDto,
    @Tenant() tenantId: string,
  ) {
    return this.entityTypeService.create(dto, tenantId);
  }

  @Put('entity-types/:id')
  @ApiOperation({
    summary: 'Update entity type',
    description: 'Update entity type',
  })
  @ApiOkResponse({ description: 'Updated entity type' })
  @ApiParam({ name: 'id', description: 'Entity type ID' })
  async updateEntityType(
    @Param('id') id: string,
    @Body() dto: Partial<CreateEntityTypeDto>,
    @Tenant() tenantId: string,
  ) {
    return this.entityTypeService.update(id, dto, tenantId);
  }

  @Delete('entity-types/:id')
  @ApiOperation({
    summary: 'Delete entity type',
    description: 'Delete entity type',
  })
  @ApiOkResponse({ description: 'Deleted entity type' })
  @ApiParam({ name: 'id', description: 'Entity type ID' })
  async deleteEntityType(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.entityTypeService.remove(id, tenantId);
  }

  // Entities endpoints
  @Get('entities')
  @ApiOperation({
    summary: 'List entities',
    description:
      'Get paginated list of entities with filters (entityType, code, name, owner, criticality, KQL)',
  })
  @ApiOkResponse({ description: 'List of entities' })
  async listEntities(
    @Query() query: QueryEntityDto,
    @Tenant() tenantId: string,
  ) {
    return this.entityService.list(tenantId, query);
  }

  @Get('entities/:id')
  @ApiOperation({
    summary: 'Get entity',
    description: 'Get single entity by ID',
  })
  @ApiOkResponse({ description: 'Entity details' })
  @ApiParam({ name: 'id', description: 'Entity ID' })
  async getEntity(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.entityService.getOne(id, tenantId);
  }

  @Post('entities')
  @ApiOperation({
    summary: 'Create entity',
    description: 'Create a new entity',
  })
  @ApiCreatedResponse({ description: 'Created entity' })
  @HttpCode(HttpStatus.CREATED)
  async createEntity(@Body() dto: CreateEntityDto, @Tenant() tenantId: string) {
    return this.entityService.create(dto, tenantId);
  }

  @Put('entities/:id')
  @ApiOperation({ summary: 'Update entity', description: 'Update entity' })
  @ApiOkResponse({ description: 'Updated entity' })
  @ApiParam({ name: 'id', description: 'Entity ID' })
  async updateEntity(
    @Param('id') id: string,
    @Body() dto: Partial<CreateEntityDto>,
    @Tenant() tenantId: string,
  ) {
    return this.entityService.update(id, dto, tenantId);
  }

  @Delete('entities/:id')
  @ApiOperation({ summary: 'Delete entity', description: 'Delete entity' })
  @ApiOkResponse({ description: 'Deleted entity' })
  @ApiParam({ name: 'id', description: 'Entity ID' })
  async deleteEntity(@Param('id') id: string, @Tenant() tenantId: string) {
    return this.entityService.remove(id, tenantId);
  }
}
