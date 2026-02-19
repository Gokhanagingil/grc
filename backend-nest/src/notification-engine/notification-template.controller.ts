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
  Request as NestRequest,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { Permissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permission.enum';
import { RequestWithUser } from '../common/types';
import { NotificationEngineService } from './services/notification-engine.service';
import { SafeTemplateService } from './services/safe-template.service';
import {
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
  PreviewTemplateDto,
  TemplateFilterDto,
} from './dto/notification-template.dto';

@Controller('grc/notification-templates')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class NotificationTemplateController {
  constructor(
    private readonly engineService: NotificationEngineService,
    private readonly templateService: SafeTemplateService,
  ) {}

  @Get()
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async listTemplates(
    @NestRequest() req: RequestWithUser,
    @Query() filter: TemplateFilterDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const result = await this.engineService.findTemplatesByTenant(tenantId, {
      page: filter.page,
      pageSize: filter.pageSize,
    });

    return {
      items: result.items,
      total: result.total,
      page: filter.page || 1,
      pageSize: filter.pageSize || 50,
    };
  }

  @Get(':id')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  async getTemplate(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const template = await this.engineService.findTemplateByTenant(
      tenantId,
      id,
    );
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  @Post()
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async createTemplate(
    @NestRequest() req: RequestWithUser,
    @Body() dto: CreateNotificationTemplateDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const validation = this.templateService.validateTemplate(dto.body);
    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Template validation failed',
        errors: validation.errors,
      });
    }

    return this.engineService.createTemplate(tenantId, dto);
  }

  @Put(':id')
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async updateTemplate(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateNotificationTemplateDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    if (dto.body) {
      const validation = this.templateService.validateTemplate(dto.body);
      if (!validation.valid) {
        throw new BadRequestException({
          message: 'Template validation failed',
          errors: validation.errors,
        });
      }
    }

    const template = await this.engineService.updateTemplate(tenantId, id, dto);
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  @Delete(':id')
  @Permissions(Permission.ADMIN_SETTINGS_WRITE)
  async deleteTemplate(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');

    const deleted = await this.engineService.deleteTemplate(tenantId, id);
    if (!deleted) throw new NotFoundException('Template not found');
    return { deleted: true };
  }

  @Post('preview')
  @Permissions(Permission.ADMIN_SETTINGS_READ)
  previewTemplate(@Body() dto: PreviewTemplateDto) {
    return this.templateService.previewTemplate(
      dto.template,
      dto.sampleData || {},
    );
  }
}
