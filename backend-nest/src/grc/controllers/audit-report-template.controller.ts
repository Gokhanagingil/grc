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
import {
  GrcAuditReportTemplateService,
  AuditContext,
} from '../services/grc-audit-report-template.service';
import { Perf } from '../../common/decorators';
import { AuditStandard, TemplateLanguage } from '../enums';
import { TemplateSectionConfig } from '../entities/grc-audit-report-template.entity';

/**
 * Create Template DTO
 */
class CreateTemplateDto {
  name: string;
  description?: string;
  standard?: AuditStandard;
  language?: TemplateLanguage;
  templateBody?: string;
  sections?: TemplateSectionConfig[];
}

/**
 * Update Template DTO
 */
class UpdateTemplateDto {
  name?: string;
  description?: string;
  standard?: AuditStandard;
  language?: TemplateLanguage;
  templateBody?: string;
  sections?: TemplateSectionConfig[];
  isActive?: boolean;
}

/**
 * Render Template DTO
 */
class RenderTemplateDto {
  context: AuditContext;
}

/**
 * Audit Report Template Controller
 *
 * API endpoints for managing audit report templates.
 * All endpoints require JWT authentication and tenant context.
 */
@Controller('audit-report-templates')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class AuditReportTemplateController {
  constructor(
    private readonly templateService: GrcAuditReportTemplateService,
  ) {}

  /**
   * GET /audit-report-templates
   * List all templates
   */
  @Get()
  @Permissions(Permission.GRC_POLICY_READ)
  @Perf()
  async listTemplates(
    @Headers('x-tenant-id') tenantId: string,
    @Query('standard') standard?: AuditStandard,
    @Query('language') language?: TemplateLanguage,
    @Query('isActive') isActive?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.templateService.getTemplates(tenantId, {
      standard,
      language,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  /**
   * GET /audit-report-templates/:id
   * Get template by ID
   */
  @Get(':id')
  @Permissions(Permission.GRC_POLICY_READ)
  @Perf()
  async getTemplate(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.templateService.getTemplate(tenantId, id);
  }

  /**
   * POST /audit-report-templates
   * Create a new template
   */
  @Post()
  @Permissions(Permission.GRC_POLICY_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createTemplate(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() createDto: CreateTemplateDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.templateService.createTemplate(
      tenantId,
      req.user.id,
      createDto,
    );
  }

  /**
   * PATCH /audit-report-templates/:id
   * Update a template
   */
  @Patch(':id')
  @Permissions(Permission.GRC_POLICY_WRITE)
  @Perf()
  async updateTemplate(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() updateDto: UpdateTemplateDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.templateService.updateTemplate(
      tenantId,
      req.user.id,
      id,
      updateDto,
    );
  }

  /**
   * DELETE /audit-report-templates/:id
   * Delete a template
   */
  @Delete(':id')
  @Permissions(Permission.GRC_POLICY_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async deleteTemplate(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    await this.templateService.deleteTemplate(tenantId, req.user.id, id);
  }

  /**
   * POST /audit-report-templates/:id/render
   * Render a template with context data
   */
  @Post(':id/render')
  @Permissions(Permission.GRC_POLICY_READ)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async renderTemplate(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() renderDto: RenderTemplateDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const html = await this.templateService.renderTemplate(
      tenantId,
      id,
      renderDto.context,
    );

    return { html };
  }

  /**
   * POST /audit-report-templates/preview
   * Preview template rendering without saving
   */
  @Post('preview')
  @Permissions(Permission.GRC_POLICY_READ)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async previewTemplate(
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: { templateBody: string; context: AuditContext },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const html = this.templateService.renderTemplateBody(
      body.templateBody,
      body.context,
    );

    return { html };
  }

  /**
   * POST /audit-report-templates/validate
   * Validate template syntax
   */
  @Post('validate')
  @Permissions(Permission.GRC_POLICY_READ)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async validateTemplate(
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: { templateBody: string },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.templateService.validateTemplate(body.templateBody);
  }

  /**
   * POST /audit-report-templates/:id/placeholders
   * Extract placeholders from a template
   */
  @Get(':id/placeholders')
  @Permissions(Permission.GRC_POLICY_READ)
  @Perf()
  async getPlaceholders(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const template = await this.templateService.getTemplate(tenantId, id);
    const placeholders = this.templateService.extractPlaceholders(
      template.templateBody || '',
    );

    return { placeholders };
  }
}
