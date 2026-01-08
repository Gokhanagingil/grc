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
import { GrcTestResultService } from '../services/grc-test-result.service';
import {
  CreateTestResultDto,
  UpdateTestResultDto,
  ReviewTestResultDto,
  TestResultFilterDto,
} from '../dto/test-result.dto';

@Controller('api/grc/test-results')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GrcTestResultController {
  constructor(private readonly testResultService: GrcTestResultService) {}

  @Post()
  @Permissions(Permission.GRC_CONTROL_WRITE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateTestResultDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.testResultService.create(tenantId, dto, req.user.id);
  }

  @Get()
  @Permissions(Permission.GRC_CONTROL_READ)
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: TestResultFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.testResultService.findAll(tenantId, filter);
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
    return this.testResultService.findOne(tenantId, id);
  }

  @Get('by-control-test/:controlTestId')
  @Permissions(Permission.GRC_CONTROL_READ)
  async findByControlTestId(
    @Headers('x-tenant-id') tenantId: string,
    @Param('controlTestId') controlTestId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.testResultService.findByControlTestId(tenantId, controlTestId);
  }

  @Put(':id')
  @Permissions(Permission.GRC_CONTROL_WRITE)
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTestResultDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.testResultService.update(tenantId, id, dto, req.user.id);
  }

  @Patch(':id/review')
  @Permissions(Permission.GRC_CONTROL_WRITE)
  async review(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: ReviewTestResultDto,
    @Request() req: { user: { id: string } },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.testResultService.review(tenantId, id, dto, req.user.id);
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
    await this.testResultService.softDelete(tenantId, id, req.user.id);
  }
}
