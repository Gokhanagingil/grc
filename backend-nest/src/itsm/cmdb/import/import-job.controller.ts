import {
  Controller,
  Get,
  Post,
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
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../../auth/permissions/permissions.guard';
import { Permissions } from '../../../auth/permissions/permissions.decorator';
import { Permission } from '../../../auth/permissions/permission.enum';
import { Perf } from '../../../common/decorators';
import { ImportJobService } from './import-job.service';
import {
  CreateImportJobDto,
  ImportJobFilterDto,
  ImportRowFilterDto,
  ReconcileResultFilterDto,
} from './dto/import-job.dto';

@Controller('grc/cmdb/import-jobs')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ImportJobController {
  constructor(private readonly importJobService: ImportJobService) {}

  @Get()
  @Permissions(Permission.CMDB_IMPORT_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: ImportJobFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.importJobService.findWithFilters(tenantId, filterDto);
  }

  @Post()
  @Permissions(Permission.CMDB_IMPORT_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateImportJobDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    if (!dto.rows || !Array.isArray(dto.rows) || dto.rows.length === 0) {
      throw new BadRequestException(
        'rows array is required and must not be empty',
      );
    }
    return this.importJobService.createImportJob(
      tenantId,
      req.user.id,
      dto.sourceId,
      dto.dryRun !== false,
      dto.rows,
    );
  }

  @Get(':id')
  @Permissions(Permission.CMDB_IMPORT_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const entity = await this.importJobService.findOneWithDetails(tenantId, id);
    if (!entity) {
      throw new NotFoundException(`Import job with ID ${id} not found`);
    }
    return entity;
  }

  @Get(':id/rows')
  @Permissions(Permission.CMDB_IMPORT_READ)
  @Perf()
  async findRows(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') jobId: string,
    @Query() filterDto: ImportRowFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.importJobService.findRowsForJob(tenantId, jobId, filterDto);
  }

  @Get(':id/results')
  @Permissions(Permission.CMDB_IMPORT_READ)
  @Perf()
  async findResults(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') jobId: string,
    @Query() filterDto: ReconcileResultFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.importJobService.findResultsForJob(tenantId, jobId, filterDto);
  }

  @Post(':id/apply')
  @Permissions(Permission.CMDB_IMPORT_WRITE)
  @Perf()
  async apply(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.importJobService.applyJob(tenantId, req.user.id, id);
  }

  @Get(':id/report')
  @Permissions(Permission.CMDB_IMPORT_READ)
  @Perf()
  async getReport(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.importJobService.getJobReport(tenantId, id);
  }
}
