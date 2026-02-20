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
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../../auth/permissions/permissions.guard';
import { Permissions } from '../../../auth/permissions/permissions.decorator';
import { Permission } from '../../../auth/permissions/permission.enum';
import { CiService } from './ci.service';
import { CreateCiDto } from './dto/create-ci.dto';
import { UpdateCiDto } from './dto/update-ci.dto';
import { CiFilterDto } from './dto/ci-filter.dto';
import { CiRelService } from '../ci-rel/ci-rel.service';
import { Perf } from '../../../common/decorators';

@Controller('grc/cmdb/cis')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CiController {
  constructor(
    private readonly ciService: CiService,
    private readonly ciRelService: CiRelService,
  ) {}

  @Get()
  @Permissions(Permission.CMDB_CI_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: CiFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.ciService.findWithFilters(tenantId, filterDto);
  }

  @Post()
  @Permissions(Permission.CMDB_CI_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateCiDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.ciService.createCi(tenantId, req.user.id, dto);
  }

  @Get(':id')
  @Permissions(Permission.CMDB_CI_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const entity = await this.ciService.findOneActiveForTenant(tenantId, id);
    if (!entity) {
      throw new NotFoundException(`CI with ID ${id} not found`);
    }
    return entity;
  }

  @Patch(':id')
  @Permissions(Permission.CMDB_CI_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateCiDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const entity = await this.ciService.updateCi(
      tenantId,
      req.user.id,
      id,
      dto,
    );
    if (!entity) {
      throw new NotFoundException(`CI with ID ${id} not found`);
    }
    return entity;
  }

  @Delete(':id')
  @Permissions(Permission.CMDB_CI_WRITE)
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
    const deleted = await this.ciService.softDeleteCi(
      tenantId,
      req.user.id,
      id,
    );
    if (!deleted) {
      throw new NotFoundException(`CI with ID ${id} not found`);
    }
  }

  @Get(':id/relationships')
  @Permissions(Permission.CMDB_REL_READ)
  @Perf()
  async getRelationships(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const entity = await this.ciService.findOneActiveForTenant(tenantId, id);
    if (!entity) {
      throw new NotFoundException(`CI with ID ${id} not found`);
    }
    return this.ciRelService.findRelationshipsForCi(tenantId, id);
  }
}
