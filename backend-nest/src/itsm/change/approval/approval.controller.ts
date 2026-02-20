import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Headers,
  Request,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../../auth/permissions/permissions.guard';
import { Permissions } from '../../../auth/permissions/permissions.decorator';
import { Permission } from '../../../auth/permissions/permission.enum';
import { ApprovalService } from './approval.service';
import { RequestApprovalDto, DecideApprovalDto } from './dto';
import { Perf } from '../../../common/decorators';

@Controller('grc/itsm')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Post('changes/:id/request-approval')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async requestApproval(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') changeId: string,
    @Body() dto: RequestApprovalDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.approvalService.requestApproval(
      tenantId,
      req.user.id,
      changeId,
      dto.comment,
    );
  }

  @Post('approvals/:approvalId/approve')
  @Permissions(Permission.ITSM_APPROVAL_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async approve(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string; role?: string } },
    @Param('approvalId') approvalId: string,
    @Body() dto: DecideApprovalDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const userRole = req.user.role || 'user';
    return this.approvalService.approve(
      tenantId,
      req.user.id,
      userRole,
      approvalId,
      dto.comment,
    );
  }

  @Post('approvals/:approvalId/reject')
  @Permissions(Permission.ITSM_APPROVAL_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async reject(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string; role?: string } },
    @Param('approvalId') approvalId: string,
    @Body() dto: DecideApprovalDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const userRole = req.user.role || 'user';
    return this.approvalService.reject(
      tenantId,
      req.user.id,
      userRole,
      approvalId,
      dto.comment,
    );
  }

  @Get('changes/:id/approvals')
  @Permissions(Permission.ITSM_APPROVAL_READ)
  @Perf()
  async listApprovals(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') changeId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.approvalService.listApprovals(tenantId, changeId);
  }
}
