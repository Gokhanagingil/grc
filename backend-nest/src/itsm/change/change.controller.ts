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
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { ChangeService } from './change.service';
import { CreateChangeDto } from './dto/create-change.dto';
import { UpdateChangeDto } from './dto/update-change.dto';
import { ChangeFilterDto } from './dto/change-filter.dto';
import { Perf } from '../../common/decorators';

@Controller('grc/itsm/changes')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ChangeController {
  constructor(private readonly changeService: ChangeService) {}

  @Get()
  @Permissions(Permission.ITSM_CHANGE_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: ChangeFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.changeService.findWithFilters(tenantId, filterDto);
  }

  @Post()
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() createChangeDto: CreateChangeDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const { plannedStartAt, plannedEndAt, ...rest } = createChangeDto;
    return this.changeService.createChange(
      tenantId,
      req.user.id,
      {
        ...rest,
        ...(plannedStartAt ? { plannedStartAt: new Date(plannedStartAt) } : {}),
        ...(plannedEndAt ? { plannedEndAt: new Date(plannedEndAt) } : {}),
      },
    );
  }

  @Get(':id')
  @Permissions(Permission.ITSM_CHANGE_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const change = await this.changeService.findOneActiveForTenant(
      tenantId,
      id,
    );
    if (!change) {
      throw new NotFoundException(`Change with ID ${id} not found`);
    }

    return change;
  }

  @Patch(':id')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() updateChangeDto: UpdateChangeDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const { plannedStartAt, plannedEndAt, actualStartAt, actualEndAt, ...rest } = updateChangeDto;
    const change = await this.changeService.updateChange(
      tenantId,
      req.user.id,
      id,
      {
        ...rest,
        ...(plannedStartAt ? { plannedStartAt: new Date(plannedStartAt) } : {}),
        ...(plannedEndAt ? { plannedEndAt: new Date(plannedEndAt) } : {}),
        ...(actualStartAt ? { actualStartAt: new Date(actualStartAt) } : {}),
        ...(actualEndAt ? { actualEndAt: new Date(actualEndAt) } : {}),
      },
    );

    if (!change) {
      throw new NotFoundException(`Change with ID ${id} not found`);
    }

    return change;
  }

  @Delete(':id')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async remove(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const deleted = await this.changeService.softDeleteChange(
      tenantId,
      req.user.id,
      id,
    );

    if (!deleted) {
      throw new NotFoundException(`Change with ID ${id} not found`);
    }
  }

  // ============================================================================
  // GRC Bridge — Linked Risks
  // ============================================================================

  @Get(':id/risks')
  @Permissions(Permission.GRC_RISK_READ)
  @ApiOperation({ summary: 'Get linked risks for a change request' })
  @ApiResponse({ status: 200, description: 'Risks retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Change not found' })
  @Perf()
  async getLinkedRisks(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const risks = await this.changeService.getLinkedRisks(tenantId, id);
    return { success: true, data: risks };
  }

  @Post(':id/risks/:riskId')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @ApiOperation({ summary: 'Link a risk to a change request' })
  @ApiResponse({ status: 201, description: 'Risk linked successfully' })
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async linkRisk(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Param('riskId') riskId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const link = await this.changeService.linkRisk(
      tenantId,
      id,
      riskId,
      req.user.id,
    );
    return { success: true, data: link };
  }

  @Delete(':id/risks/:riskId')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @ApiOperation({ summary: 'Unlink a risk from a change request' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async unlinkRisk(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Param('riskId') riskId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    await this.changeService.unlinkRisk(tenantId, id, riskId);
  }

  // ============================================================================
  // GRC Bridge — Linked Controls
  // ============================================================================

  @Get(':id/controls')
  @Permissions(Permission.GRC_CONTROL_READ)
  @ApiOperation({ summary: 'Get linked controls for a change request' })
  @ApiResponse({ status: 200, description: 'Controls retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Change not found' })
  @Perf()
  async getLinkedControls(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const controls = await this.changeService.getLinkedControls(tenantId, id);
    return { success: true, data: controls };
  }

  @Post(':id/controls/:controlId')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @ApiOperation({ summary: 'Link a control to a change request' })
  @ApiResponse({ status: 201, description: 'Control linked successfully' })
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async linkControl(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Param('controlId') controlId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const link = await this.changeService.linkControl(
      tenantId,
      id,
      controlId,
      req.user.id,
    );
    return { success: true, data: link };
  }

  @Delete(':id/controls/:controlId')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @ApiOperation({ summary: 'Unlink a control from a change request' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async unlinkControl(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Param('controlId') controlId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    await this.changeService.unlinkControl(tenantId, id, controlId);
  }
}
