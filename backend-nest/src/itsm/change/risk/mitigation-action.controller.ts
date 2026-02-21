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
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../../auth/permissions/permissions.guard';
import { Permissions } from '../../../auth/permissions/permissions.decorator';
import { Permission } from '../../../auth/permissions/permission.enum';
import { Perf } from '../../../common/decorators';
import { MitigationActionService } from './mitigation-action.service';
import { CreateMitigationActionDto } from './dto/create-mitigation-action.dto';
import { MitigationActionStatus } from './mitigation-action.entity';

@Controller('grc/itsm/changes')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class MitigationActionController {
  constructor(
    private readonly mitigationActionService: MitigationActionService,
  ) {}

  @Post(':changeId/mitigation-actions')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Request() req: { tenantId: string; user: { id: string } },
    @Param('changeId') changeId: string,
    @Body() dto: CreateMitigationActionDto,
  ) {
    const action = await this.mitigationActionService.create(
      req.tenantId,
      req.user.id,
      changeId,
      dto,
    );
    return { success: true, data: action };
  }

  @Get(':changeId/mitigation-actions')
  @Permissions(Permission.ITSM_CHANGE_READ)
  @Perf()
  async list(
    @Request() req: { tenantId: string },
    @Param('changeId') changeId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    const result = await this.mitigationActionService.listByChange(
      req.tenantId,
      changeId,
      {
        page: page ? parseInt(page, 10) : undefined,
        pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
        status,
      },
    );
    return { success: true, data: result };
  }

  @Get(':changeId/mitigation-actions/:actionId')
  @Permissions(Permission.ITSM_CHANGE_READ)
  @Perf()
  async getById(
    @Request() req: { tenantId: string },
    @Param('actionId') actionId: string,
  ) {
    const action = await this.mitigationActionService.getById(
      req.tenantId,
      actionId,
    );
    return { success: true, data: action };
  }

  @Patch(':changeId/mitigation-actions/:actionId/status')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @Perf()
  async updateStatus(
    @Request() req: { tenantId: string; user: { id: string } },
    @Param('actionId') actionId: string,
    @Body() body: { status: MitigationActionStatus; comment?: string },
  ) {
    const action = await this.mitigationActionService.updateStatus(
      req.tenantId,
      req.user.id,
      actionId,
      body.status,
      body.comment,
    );
    return { success: true, data: action };
  }

  @Delete(':changeId/mitigation-actions/:actionId')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async delete(
    @Request() req: { tenantId: string; user: { id: string } },
    @Param('actionId') actionId: string,
  ) {
    await this.mitigationActionService.softDelete(
      req.tenantId,
      req.user.id,
      actionId,
    );
  }
}
