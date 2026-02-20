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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { Perf } from '../../common/decorators';
import { ChoiceService } from './choice.service';
import { CreateChoiceDto } from './dto/create-choice.dto';
import { UpdateChoiceDto } from './dto/update-choice.dto';

@Controller('grc/itsm/choices')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ChoiceController {
  constructor(private readonly choiceService: ChoiceService) {}

  @Get()
  @Permissions(Permission.ITSM_CHOICE_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query('table') tableName?: string,
    @Query('field') fieldName?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    if (tableName && fieldName) {
      return this.choiceService.getChoices(tenantId, tableName, fieldName);
    }

    if (tableName) {
      return this.choiceService.getAllChoicesForTable(tenantId, tableName);
    }

    throw new BadRequestException(
      'At least "table" query parameter is required',
    );
  }

  @Get('tables')
  @Permissions(Permission.ITSM_CHOICE_READ)
  @Perf()
  getManagedTables() {
    return {
      tables: [
        {
          name: 'itsm_incidents',
          fields: this.choiceService.getChoiceManagedFields('itsm_incidents'),
        },
        {
          name: 'itsm_changes',
          fields: this.choiceService.getChoiceManagedFields('itsm_changes'),
        },
        {
          name: 'itsm_services',
          fields: this.choiceService.getChoiceManagedFields('itsm_services'),
        },
      ],
    };
  }

  @Get(':id')
  @Permissions(Permission.ITSM_CHOICE_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const choice = await this.choiceService.findById(tenantId, id);
    if (!choice) {
      throw new NotFoundException(`Choice with ID ${id} not found`);
    }
    return choice;
  }

  @Post()
  @Permissions(Permission.ITSM_CHOICE_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateChoiceDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.choiceService.createChoice(tenantId, req.user.id, dto);
  }

  @Patch(':id')
  @Permissions(Permission.ITSM_CHOICE_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateChoiceDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const choice = await this.choiceService.updateChoice(
      tenantId,
      req.user.id,
      id,
      dto,
    );

    if (!choice) {
      throw new NotFoundException(`Choice with ID ${id} not found`);
    }

    return choice;
  }

  @Delete(':id')
  @Permissions(Permission.ITSM_CHOICE_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async deactivate(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const result = await this.choiceService.deactivateChoice(
      tenantId,
      req.user.id,
      id,
    );

    if (!result) {
      throw new NotFoundException(`Choice with ID ${id} not found`);
    }
  }
}
