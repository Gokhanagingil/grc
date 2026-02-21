import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Logger,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { Perf } from '../../common/decorators';
import { KnownErrorService } from './known-error.service';
import { CreateKnownErrorDto } from './dto/create-known-error.dto';
import { UpdateKnownErrorDto } from './dto/update-known-error.dto';
import { KnownErrorFilterDto } from './dto/known-error-filter.dto';

/**
 * Known Error Controller
 *
 * REST API for Known Error CRUD operations.
 * All endpoints are tenant-scoped and permission-guarded.
 *
 * Note: Controller path uses 'grc/...' with NO 'api/' prefix.
 * Nginx strips /api before proxying to backend.
 */
@Controller('grc/itsm/known-errors')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class KnownErrorController {
  private readonly logger = new Logger(KnownErrorController.name);

  constructor(private readonly knownErrorService: KnownErrorService) {}

  /**
   * List Known Errors with filters and pagination
   */
  @Get()
  @Permissions(Permission.ITSM_KNOWN_ERROR_READ)
  @Perf()
  async list(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: KnownErrorFilterDto,
  ) {
    const result = await this.knownErrorService.findWithFilters(
      tenantId,
      filterDto,
    );
    return { data: result };
  }

  /**
   * Create a new Known Error
   */
  @Post()
  @Permissions(Permission.ITSM_KNOWN_ERROR_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateKnownErrorDto,
  ) {
    const knownError = await this.knownErrorService.createKnownError(
      tenantId,
      req.user.id,
      dto,
    );
    return { data: knownError };
  }

  /**
   * Get a single Known Error by ID
   */
  @Get(':id')
  @Permissions(Permission.ITSM_KNOWN_ERROR_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    const knownError = await this.knownErrorService.findOne(tenantId, id);
    if (!knownError) {
      throw new NotFoundException(`Known Error ${id} not found`);
    }
    return { data: knownError };
  }

  /**
   * Update a Known Error
   */
  @Patch(':id')
  @Permissions(Permission.ITSM_KNOWN_ERROR_UPDATE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateKnownErrorDto,
  ) {
    const knownError = await this.knownErrorService.updateKnownError(
      tenantId,
      req.user.id,
      id,
      dto,
    );
    if (!knownError) {
      throw new NotFoundException(`Known Error ${id} not found`);
    }
    return { data: knownError };
  }

  /**
   * Soft delete a Known Error
   */
  @Delete(':id')
  @Permissions(Permission.ITSM_KNOWN_ERROR_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async remove(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    const deleted = await this.knownErrorService.softDeleteKnownError(
      tenantId,
      req.user.id,
      id,
    );
    if (!deleted) {
      throw new NotFoundException(`Known Error ${id} not found`);
    }
  }
}
