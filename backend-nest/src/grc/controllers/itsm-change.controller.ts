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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { Perf } from '../../common/decorators';
import { ItsmChangeService } from '../services/itsm-change.service';
import {
  CreateItsmChangeDto,
  UpdateItsmChangeDto,
  ItsmChangeFilterDto,
} from '../dto/itsm.dto';
import {
  ItsmChangeType,
  ItsmChangeState,
  ItsmChangeRisk,
  ItsmApprovalStatus,
} from '../enums';

/**
 * ITSM Change Controller
 *
 * Manages IT change requests for the ITSM module (ITIL v5 aligned).
 * Includes GRC Bridge integration for linking to risks and controls.
 * All endpoints require JWT authentication and tenant context.
 */
@ApiTags('ITSM Changes')
@ApiBearerAuth()
@ApiHeader({ name: 'x-tenant-id', description: 'Tenant ID', required: true })
@Controller('grc/itsm/changes')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ItsmChangeController {
  constructor(private readonly changeService: ItsmChangeService) {}

  @Post()
  @Permissions(Permission.GRC_CONTROL_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new ITSM change request' })
  @ApiResponse({ status: 201, description: 'Change created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateItsmChangeDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const change = await this.changeService.create(tenantId, dto, req.user.id);
    return { success: true, data: change };
  }

  @Get()
  @Permissions(Permission.GRC_CONTROL_READ)
  @ApiOperation({ summary: 'List all ITSM change requests' })
  @ApiResponse({ status: 200, description: 'Changes retrieved successfully' })
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: ItsmChangeFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const result = await this.changeService.findAll(tenantId, filter);
    return { success: true, data: result.items, total: result.total };
  }

  @Get('filters')
  @Permissions(Permission.GRC_CONTROL_READ)
  @ApiOperation({ summary: 'Get change filter metadata' })
  @ApiResponse({
    status: 200,
    description: 'Filter metadata returned successfully',
  })
  @Perf()
  getFilters(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return {
      success: true,
      data: {
        types: Object.values(ItsmChangeType),
        states: Object.values(ItsmChangeState),
        risks: Object.values(ItsmChangeRisk),
        approvalStatuses: Object.values(ItsmApprovalStatus),
      },
    };
  }

  @Get(':id')
  @Permissions(Permission.GRC_CONTROL_READ)
  @ApiOperation({ summary: 'Get a single ITSM change request by ID' })
  @ApiResponse({ status: 200, description: 'Change retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Change not found' })
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const change = await this.changeService.findOne(tenantId, id);
    return { success: true, data: change };
  }

  @Patch(':id')
  @Permissions(Permission.GRC_CONTROL_WRITE)
  @ApiOperation({ summary: 'Update an ITSM change request' })
  @ApiResponse({ status: 200, description: 'Change updated successfully' })
  @ApiResponse({ status: 404, description: 'Change not found' })
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateItsmChangeDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    const change = await this.changeService.update(
      tenantId,
      id,
      dto,
      req.user.id,
    );
    return { success: true, data: change };
  }

  @Delete(':id')
  @Permissions(Permission.GRC_CONTROL_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an ITSM change request' })
  @ApiResponse({ status: 204, description: 'Change deleted successfully' })
  @ApiResponse({ status: 404, description: 'Change not found' })
  @Perf()
  async delete(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    await this.changeService.delete(tenantId, id, req.user.id);
  }

  // ============================================================================
  // GRC Bridge Endpoints - Link/Unlink Risks and Controls
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
      throw new BadRequestException('Tenant ID is required');
    }
    const risks = await this.changeService.getLinkedRisks(tenantId, id);
    return { success: true, data: risks };
  }

  @Post(':id/risks/:riskId')
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Link a risk to a change request' })
  @ApiResponse({ status: 201, description: 'Risk linked successfully' })
  @ApiResponse({ status: 400, description: 'Risk already linked' })
  @ApiResponse({ status: 404, description: 'Change or risk not found' })
  @Perf()
  async linkRisk(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Param('riskId') riskId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
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
  @Permissions(Permission.GRC_RISK_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unlink a risk from a change request' })
  @ApiResponse({ status: 204, description: 'Risk unlinked successfully' })
  @ApiResponse({ status: 404, description: 'Link not found' })
  @Perf()
  async unlinkRisk(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Param('riskId') riskId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    await this.changeService.unlinkRisk(tenantId, id, riskId, req.user.id);
  }

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
      throw new BadRequestException('Tenant ID is required');
    }
    const controls = await this.changeService.getLinkedControls(tenantId, id);
    return { success: true, data: controls };
  }

  @Post(':id/controls/:controlId')
  @Permissions(Permission.GRC_CONTROL_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Link a control to a change request' })
  @ApiResponse({ status: 201, description: 'Control linked successfully' })
  @ApiResponse({ status: 400, description: 'Control already linked' })
  @ApiResponse({ status: 404, description: 'Change or control not found' })
  @Perf()
  async linkControl(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Param('controlId') controlId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
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
  @Permissions(Permission.GRC_CONTROL_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unlink a control from a change request' })
  @ApiResponse({ status: 204, description: 'Control unlinked successfully' })
  @ApiResponse({ status: 404, description: 'Link not found' })
  @Perf()
  async unlinkControl(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Param('controlId') controlId: string,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    await this.changeService.unlinkControl(
      tenantId,
      id,
      controlId,
      req.user.id,
    );
  }
}
