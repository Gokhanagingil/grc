import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { GrcControlTestService } from '../services/grc-control-test.service';
import {
  CreateControlTestDto,
  UpdateControlTestDto,
  UpdateControlTestStatusDto,
  ControlTestFilterDto,
} from '../dto/control-test.dto';
import { GrcTestResultService } from '../services/grc-test-result.service';
import { TestResultFilterDto } from '../dto/test-result.dto';

@Controller('grc/control-tests')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GrcControlTestController {
  constructor(
    private readonly controlTestService: GrcControlTestService,
    private readonly testResultService: GrcTestResultService,
  ) {}

  @Post()
  @Permissions(Permission.GRC_CONTROL_WRITE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateControlTestDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.controlTestService.create(tenantId, dto, req.user.id);
  }

  @Get()
  @Permissions(Permission.GRC_CONTROL_READ)
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: ControlTestFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.controlTestService.findAll(tenantId, filter);
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
    return this.controlTestService.findOne(tenantId, id);
  }

  @Put(':id')
  @Permissions(Permission.GRC_CONTROL_WRITE)
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateControlTestDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.controlTestService.update(tenantId, id, dto, req.user.id);
  }

  @Patch(':id/status')
  @Permissions(Permission.GRC_CONTROL_WRITE)
  async updateStatus(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateControlTestStatusDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.controlTestService.updateStatus(tenantId, id, dto, req.user.id);
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
    await this.controlTestService.softDelete(tenantId, id, req.user.id);
  }

  // ============================================================================
  // Control Tests v1: Test-centric Results Endpoint
  // ============================================================================

  /**
   * GET /grc/control-tests/:testId/results
   * Get all test results for a specific control test
   * List Contract v1 compliant with pagination, search, and filtering
   */
  @Get(':testId/results')
  @Permissions(Permission.GRC_CONTROL_READ)
  async getTestResults(
    @Headers('x-tenant-id') tenantId: string,
    @Param('testId') testId: string,
    @Query() filter: TestResultFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    const result = await this.testResultService.findAll(tenantId, {
      ...filter,
      controlTestId: testId,
    });

    return {
      success: true,
      data: {
        items: result.items,
        total: result.total,
        page: filter.page || 1,
        pageSize: filter.pageSize || 20,
        totalPages: Math.ceil(result.total / (filter.pageSize || 20)),
      },
    };
  }
}
