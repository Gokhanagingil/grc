import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  Request,
  UseGuards,
  ParseUUIDPipe,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { ProcessViolationService } from '../services/process-violation.service';
import {
  UpdateProcessViolationDto,
  LinkRiskDto,
  ProcessViolationFilterDto,
} from '../dto';

@Controller('grc/process-violations')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ProcessViolationController {
  constructor(
    private readonly processViolationService: ProcessViolationService,
  ) {}

  @Get()
  @Permissions(Permission.GRC_PROCESS_READ)
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: ProcessViolationFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.processViolationService.findWithFilters(tenantId, filterDto);
  }

  @Get('statistics')
  @Permissions(Permission.GRC_PROCESS_READ)
  async getStatistics(@Headers('x-tenant-id') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.processViolationService.getStatistics(tenantId);
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
    const violation = await this.processViolationService.findWithRelations(
      tenantId,
      id,
    );
    if (!violation) {
      throw new NotFoundException(`ProcessViolation with ID ${id} not found`);
    }
    return violation;
  }

  @Patch(':id')
  @Permissions(Permission.GRC_PROCESS_WRITE)
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateProcessViolationDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const violation = await this.processViolationService.updateViolation(
      tenantId,
      req.user.id,
      id,
      updateDto,
    );
    if (!violation) {
      throw new NotFoundException(`ProcessViolation with ID ${id} not found`);
    }
    return violation;
  }

  @Patch(':id/link-risk')
  @Permissions(Permission.GRC_PROCESS_WRITE)
  async linkRisk(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() linkDto: LinkRiskDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const violation = await this.processViolationService.linkRisk(
      tenantId,
      req.user.id,
      id,
      linkDto.riskId,
    );
    if (!violation) {
      throw new NotFoundException(`ProcessViolation with ID ${id} not found`);
    }
    return violation;
  }

  @Patch(':id/unlink-risk')
  @Permissions(Permission.GRC_PROCESS_WRITE)
  async unlinkRisk(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const violation = await this.processViolationService.unlinkRisk(
      tenantId,
      req.user.id,
      id,
    );
    if (!violation) {
      throw new NotFoundException(`ProcessViolation with ID ${id} not found`);
    }
    return violation;
  }
}
