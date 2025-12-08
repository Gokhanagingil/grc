import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Headers,
  Request,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { MetadataService } from '../services/metadata.service';
import { Perf } from '../../common/decorators';
import { ClassificationTagType } from '../enums';

/**
 * Create Field Metadata DTO
 */
class CreateFieldMetadataDto {
  tableName: string;
  fieldName: string;
  label?: string;
  description?: string;
  dataType?: string;
  isSensitive?: boolean;
  isPii?: boolean;
}

/**
 * Update Field Metadata DTO
 */
class UpdateFieldMetadataDto {
  label?: string;
  description?: string;
  dataType?: string;
  isSensitive?: boolean;
  isPii?: boolean;
}

/**
 * Create Tag DTO
 */
class CreateTagDto {
  tagName: string;
  tagType: ClassificationTagType;
  description?: string;
  color?: string;
}

/**
 * Update Tag DTO
 */
class UpdateTagDto {
  tagName?: string;
  tagType?: ClassificationTagType;
  description?: string;
  color?: string;
}

/**
 * Assign Tag DTO
 */
class AssignTagDto {
  tagId: string;
}

/**
 * Metadata Controller
 *
 * API endpoints for managing field metadata and classification tags.
 * All endpoints require JWT authentication and tenant context.
 */
@Controller('metadata')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class MetadataController {
  constructor(private readonly metadataService: MetadataService) {}

  // ============================================================================
  // Field Metadata Endpoints
  // ============================================================================

  /**
   * GET /metadata/fields
   * List all field metadata
   */
  @Get('fields')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  async listFieldMetadata(
    @Headers('x-tenant-id') tenantId: string,
    @Query('tableName') tableName?: string,
    @Query('isSensitive') isSensitive?: string,
    @Query('isPii') isPii?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.metadataService.getFieldMetadata(tenantId, {
      tableName,
      isSensitive: isSensitive === 'true' ? true : isSensitive === 'false' ? false : undefined,
      isPii: isPii === 'true' ? true : isPii === 'false' ? false : undefined,
    });
  }

  /**
   * GET /metadata/fields/tables
   * Get distinct table names
   */
  @Get('fields/tables')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  async getTableNames(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.metadataService.getTableNames(tenantId);
  }

  /**
   * GET /metadata/fields/:id
   * Get field metadata by ID
   */
  @Get('fields/:id')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  async getFieldMetadata(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.metadataService.getFieldMetadataById(tenantId, id);
  }

  /**
   * POST /metadata/fields
   * Create field metadata
   */
  @Post('fields')
  @Permissions(Permission.GRC_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createFieldMetadata(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() createDto: CreateFieldMetadataDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.metadataService.createFieldMetadata(
      tenantId,
      req.user.id,
      createDto,
    );
  }

  /**
   * PATCH /metadata/fields/:id
   * Update field metadata
   */
  @Patch('fields/:id')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  async updateFieldMetadata(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() updateDto: UpdateFieldMetadataDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.metadataService.updateFieldMetadata(
      tenantId,
      req.user.id,
      id,
      updateDto,
    );
  }

  /**
   * DELETE /metadata/fields/:id
   * Delete field metadata
   */
  @Delete('fields/:id')
  @Permissions(Permission.GRC_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async deleteFieldMetadata(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.metadataService.deleteFieldMetadata(tenantId, req.user.id, id);
  }

  /**
   * GET /metadata/fields/:id/tags
   * Get tags assigned to a field
   */
  @Get('fields/:id/tags')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  async getFieldTags(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.metadataService.getTagsForField(tenantId, id);
  }

  /**
   * POST /metadata/fields/:id/tags
   * Assign a tag to a field
   */
  @Post('fields/:id/tags')
  @Permissions(Permission.GRC_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async assignTag(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() assignDto: AssignTagDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.metadataService.assignTag(tenantId, id, assignDto.tagId);
  }

  /**
   * DELETE /metadata/fields/:id/tags/:tagId
   * Remove a tag from a field
   */
  @Delete('fields/:id/tags/:tagId')
  @Permissions(Permission.GRC_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async removeTag(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Param('tagId') tagId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.metadataService.removeTag(tenantId, id, tagId);
  }

  // ============================================================================
  // Classification Tag Endpoints
  // ============================================================================

  /**
   * GET /metadata/tags
   * List all classification tags
   */
  @Get('tags')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  async listTags(
    @Headers('x-tenant-id') tenantId: string,
    @Query('tagType') tagType?: ClassificationTagType,
    @Query('isSystem') isSystem?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.metadataService.getTags(tenantId, {
      tagType,
      isSystem: isSystem === 'true' ? true : isSystem === 'false' ? false : undefined,
    });
  }

  /**
   * GET /metadata/tags/:id
   * Get tag by ID
   */
  @Get('tags/:id')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  async getTag(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.metadataService.getTagById(tenantId, id);
  }

  /**
   * GET /metadata/tags/:id/fields
   * Get fields with a specific tag
   */
  @Get('tags/:id/fields')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  async getFieldsWithTag(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.metadataService.getFieldsWithTag(tenantId, id);
  }

  /**
   * POST /metadata/tags
   * Create a classification tag
   */
  @Post('tags')
  @Permissions(Permission.GRC_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createTag(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() createDto: CreateTagDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.metadataService.createTag(tenantId, req.user.id, createDto);
  }

  /**
   * PATCH /metadata/tags/:id
   * Update a classification tag
   */
  @Patch('tags/:id')
  @Permissions(Permission.GRC_ADMIN)
  @Perf()
  async updateTag(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() updateDto: UpdateTagDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.metadataService.updateTag(tenantId, req.user.id, id, updateDto);
  }

  /**
   * DELETE /metadata/tags/:id
   * Delete a classification tag
   */
  @Delete('tags/:id')
  @Permissions(Permission.GRC_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async deleteTag(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.metadataService.deleteTag(tenantId, req.user.id, id);
  }

  /**
   * POST /metadata/seed
   * Seed default classification tags
   */
  @Post('seed')
  @Permissions(Permission.GRC_ADMIN)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async seedDefaultTags(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.metadataService.seedDefaultTags(tenantId, req.user.id);
    return { message: 'Default tags seeded successfully' };
  }
}
