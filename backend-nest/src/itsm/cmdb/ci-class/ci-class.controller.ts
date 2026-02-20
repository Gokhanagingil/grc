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
import { CiClassService } from './ci-class.service';
import { CreateCiClassDto } from './dto/create-ci-class.dto';
import { UpdateCiClassDto } from './dto/update-ci-class.dto';
import { CiClassFilterDto } from './dto/ci-class-filter.dto';
import { Perf } from '../../../common/decorators';

@Controller('grc/cmdb/classes')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CiClassController {
  constructor(private readonly ciClassService: CiClassService) {}

  @Get()
  @Permissions(Permission.CMDB_CLASS_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: CiClassFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.ciClassService.findWithFilters(tenantId, filterDto);
  }

  @Post()
  @Permissions(Permission.CMDB_CLASS_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateCiClassDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.ciClassService.createCiClass(tenantId, req.user.id, dto);
  }

  @Get(':id')
  @Permissions(Permission.CMDB_CLASS_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const entity = await this.ciClassService.findOneActiveForTenant(
      tenantId,
      id,
    );
    if (!entity) {
      throw new NotFoundException(`CI Class with ID ${id} not found`);
    }
    return entity;
  }

  @Patch(':id')
  @Permissions(Permission.CMDB_CLASS_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateCiClassDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const entity = await this.ciClassService.updateCiClass(
      tenantId,
      req.user.id,
      id,
      dto,
    );
    if (!entity) {
      throw new NotFoundException(`CI Class with ID ${id} not found`);
    }
    return entity;
  }

  @Delete(':id')
  @Permissions(Permission.CMDB_CLASS_WRITE)
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
    const deleted = await this.ciClassService.softDeleteCiClass(
      tenantId,
      req.user.id,
      id,
    );
    if (!deleted) {
      throw new NotFoundException(`CI Class with ID ${id} not found`);
    }
  }
}
