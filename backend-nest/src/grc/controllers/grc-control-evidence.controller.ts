import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { GrcControlEvidenceService } from '../services/grc-control-evidence.service';
import {
  CreateControlEvidenceDto,
  UpdateControlEvidenceDto,
  ControlEvidenceFilterDto,
} from '../dto/control-evidence.dto';

@Controller('grc/control-evidence')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GrcControlEvidenceController {
  constructor(
    private readonly controlEvidenceService: GrcControlEvidenceService,
  ) {}

  @Post()
  @Permissions(Permission.GRC_CONTROL_WRITE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateControlEvidenceDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.controlEvidenceService.create(tenantId, dto, req.user.id);
  }

  @Get()
  @Permissions(Permission.GRC_CONTROL_READ)
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: ControlEvidenceFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.controlEvidenceService.findAll(tenantId, filter);
  }

  @Get(':id')
  @Permissions(Permission.GRC_CONTROL_READ)
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.controlEvidenceService.findOne(tenantId, id);
  }

  @Get('by-control/:controlId')
  @Permissions(Permission.GRC_CONTROL_READ)
  async findByControlId(
    @Headers('x-tenant-id') tenantId: string,
    @Param('controlId') controlId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.controlEvidenceService.findByControlId(tenantId, controlId);
  }

  @Get('by-evidence/:evidenceId')
  @Permissions(Permission.GRC_EVIDENCE_READ)
  async findByEvidenceId(
    @Headers('x-tenant-id') tenantId: string,
    @Param('evidenceId') evidenceId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.controlEvidenceService.findByEvidenceId(tenantId, evidenceId);
  }

  @Put(':id')
  @Permissions(Permission.GRC_CONTROL_WRITE)
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateControlEvidenceDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.controlEvidenceService.update(tenantId, id, dto, req.user.id);
  }

  @Delete(':id')
  @Permissions(Permission.GRC_CONTROL_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    await this.controlEvidenceService.delete(tenantId, id, req.user.id);
  }

  @Delete('unlink/:controlId/:evidenceId')
  @Permissions(Permission.GRC_CONTROL_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlinkEvidence(
    @Headers('x-tenant-id') tenantId: string,
    @Param('controlId') controlId: string,
    @Param('evidenceId') evidenceId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    await this.controlEvidenceService.unlinkEvidence(
      tenantId,
      controlId,
      evidenceId,
      req.user.id,
    );
  }
}
