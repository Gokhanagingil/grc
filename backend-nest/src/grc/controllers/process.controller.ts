import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  Request,
  UseGuards,
  ParseUUIDPipe,
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
import { ProcessService } from '../services/process.service';
import { ProcessComplianceService } from '../services/process-compliance.service';
import {
  CreateProcessDto,
  UpdateProcessDto,
  ProcessFilterDto,
} from '../dto';

@Controller('grc/processes')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ProcessController {
  constructor(
    private readonly processService: ProcessService,
    private readonly complianceService: ProcessComplianceService,
  ) {}

  @Get()
  @Permissions(Permission.GRC_PROCESS_READ)
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: ProcessFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.processService.findWithFilters(tenantId, filterDto);
  }

  @Get('compliance-overview')
  @Permissions(Permission.GRC_PROCESS_READ)
  async getComplianceOverview(
    @Headers('x-tenant-id') tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    return this.complianceService.getComplianceOverview(tenantId, fromDate, toDate);
  }

  @Get('statistics')
  @Permissions(Permission.GRC_PROCESS_READ)
  async getStatistics(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.processService.getStatistics(tenantId);
  }

  @Get(':id')
  @Permissions(Permission.GRC_PROCESS_READ)
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const process = await this.processService.findWithControls(tenantId, id);
    if (!process) {
      throw new NotFoundException(`Process with ID ${id} not found`);
    }
    return process;
  }

  @Get(':id/compliance-score')
  @Permissions(Permission.GRC_PROCESS_READ)
  async getComplianceScore(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    const score = await this.complianceService.getComplianceScore(
      tenantId,
      id,
      fromDate,
      toDate,
    );
    if (!score) {
      throw new NotFoundException(`Process with ID ${id} not found`);
    }
    return score;
  }

  @Get(':id/compliance-trend')
  @Permissions(Permission.GRC_PROCESS_READ)
  async getComplianceTrend(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('periodDays') periodDays?: string,
    @Query('numberOfPeriods') numberOfPeriods?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const trend = await this.complianceService.getComplianceTrend(
      tenantId,
      id,
      periodDays ? parseInt(periodDays, 10) : 30,
      numberOfPeriods ? parseInt(numberOfPeriods, 10) : 6,
    );
    if (!trend) {
      throw new NotFoundException(`Process with ID ${id} not found`);
    }
    return trend;
  }

  @Post()
  @Permissions(Permission.GRC_PROCESS_WRITE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() createDto: CreateProcessDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.processService.createProcess(tenantId, req.user.id, createDto);
  }

  @Patch(':id')
  @Permissions(Permission.GRC_PROCESS_WRITE)
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateProcessDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const process = await this.processService.updateProcess(
      tenantId,
      req.user.id,
      id,
      updateDto,
    );
    if (!process) {
      throw new NotFoundException(`Process with ID ${id} not found`);
    }
    return process;
  }

  @Delete(':id')
  @Permissions(Permission.GRC_PROCESS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const deleted = await this.processService.softDeleteProcess(
      tenantId,
      req.user.id,
      id,
    );
    if (!deleted) {
      throw new NotFoundException(`Process with ID ${id} not found`);
    }
  }
}
