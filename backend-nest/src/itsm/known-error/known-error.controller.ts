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
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { TenantGuard } from '../../auth/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { RequirePermissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { CurrentUser } from '../../auth/current-user.decorator';
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
  @RequirePermissions(Permission.ITSM_KNOWN_ERROR_READ)
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
  @RequirePermissions(Permission.ITSM_KNOWN_ERROR_CREATE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateKnownErrorDto,
  ) {
    const knownError = await this.knownErrorService.createKnownError(
      tenantId,
      userId,
      dto,
    );
    return { data: knownError };
  }

  /**
   * Get a single Known Error by ID
   */
  @Get(':id')
  @RequirePermissions(Permission.ITSM_KNOWN_ERROR_READ)
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
  @RequirePermissions(Permission.ITSM_KNOWN_ERROR_UPDATE)
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateKnownErrorDto,
  ) {
    const knownError = await this.knownErrorService.updateKnownError(
      tenantId,
      userId,
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
  @RequirePermissions(Permission.ITSM_KNOWN_ERROR_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Headers('x-tenant-id') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    const deleted = await this.knownErrorService.softDeleteKnownError(
      tenantId,
      userId,
      id,
    );
    if (!deleted) {
      throw new NotFoundException(`Known Error ${id} not found`);
    }
  }
}
