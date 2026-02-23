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
  NotFoundException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../../auth/permissions/permissions.guard';
import { Permissions } from '../../../auth/permissions/permissions.decorator';
import { Permission } from '../../../auth/permissions/permission.enum';
import { Perf } from '../../../common/decorators';
import { ChangeTemplateService } from './change-template.service';
import { CreateChangeTemplateDto } from './dto/create-change-template.dto';
import { UpdateChangeTemplateDto } from './dto/update-change-template.dto';
import { ApplyTemplateDto } from './dto/apply-template.dto';

@Controller('grc/itsm/change-templates')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ChangeTemplateController {
  constructor(private readonly templateService: ChangeTemplateService) {}

  @Get()
  @Permissions(Permission.ITSM_CHANGE_READ)
  @Perf()
  async listTemplates(
    @Headers('x-tenant-id') tenantId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.templateService.findTemplates(
      tenantId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
      search,
      isActive !== undefined ? isActive === 'true' : undefined,
    );
  }

  @Post()
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async createTemplate(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateChangeTemplateDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.templateService.createTemplate(tenantId, req.user.id, dto);
  }

  @Get(':id')
  @Permissions(Permission.ITSM_CHANGE_READ)
  @Perf()
  async getTemplate(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const template = await this.templateService.findTemplateById(tenantId, id);
    if (!template) {
      throw new NotFoundException(`Template ${id} not found`);
    }
    return template;
  }

  @Patch(':id')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @Perf()
  async updateTemplate(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateChangeTemplateDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const template = await this.templateService.updateTemplate(
      tenantId,
      req.user.id,
      id,
      dto,
    );
    if (!template) {
      throw new NotFoundException(`Template ${id} not found`);
    }
    return template;
  }

  @Delete(':id')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
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
    const deleted = await this.templateService.softDeleteTemplate(
      tenantId,
      req.user.id,
      id,
    );
    if (!deleted) {
      throw new NotFoundException(`Template ${id} not found`);
    }
  }

  @Post('apply')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @Perf()
  async applyTemplateToChange(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: ApplyTemplateDto & { changeId: string },
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    if (!dto.changeId) {
      throw new BadRequestException('changeId is required');
    }
    return this.templateService.applyTemplateToChange(
      tenantId,
      req.user.id,
      dto.changeId,
      dto.templateId,
      dto.force,
    );
  }
}
