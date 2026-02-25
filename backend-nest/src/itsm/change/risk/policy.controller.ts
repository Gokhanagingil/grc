import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../../auth/permissions/permissions.guard';
import { Permissions } from '../../../auth/permissions/permissions.decorator';
import { Permission } from '../../../auth/permissions/permission.enum';
import { PolicyService } from './policy.service';
import {
  CreateChangePolicyDto,
  UpdateChangePolicyDto,
  PolicyFilterDto,
} from './dto';

@Controller('grc/itsm/change-policies')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class PolicyController {
  constructor(private readonly policyService: PolicyService) {}

  @Get()
  @Permissions(Permission.ITSM_CHANGE_READ)
  async findAll(
    @Query() filterDto: PolicyFilterDto,
    @Req() req: { tenantId: string },
  ) {
    return this.policyService.findAll(req.tenantId, filterDto);
  }

  @Get(':id')
  @Permissions(Permission.ITSM_CHANGE_READ)
  async findOne(@Param('id') id: string, @Req() req: { tenantId: string }) {
    const policy = await this.policyService.findOne(req.tenantId, id);
    if (!policy) {
      throw new NotFoundException(`Policy ${id} not found`);
    }
    return policy;
  }

  @Post()
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateChangePolicyDto,
    @Req() req: { tenantId: string; user: { id: string } },
  ) {
    const policy = await this.policyService.create(
      req.tenantId,
      req.user.id,
      dto,
    );
    return policy;
  }

  @Put(':id')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateChangePolicyDto,
    @Req() req: { tenantId: string; user: { id: string } },
  ) {
    const policy = await this.policyService.update(
      req.tenantId,
      req.user.id,
      id,
      dto,
    );
    if (!policy) {
      throw new NotFoundException(`Policy ${id} not found`);
    }
    return policy;
  }

  @Delete(':id')
  @Permissions(Permission.ITSM_CHANGE_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Req() req: { tenantId: string; user: { id: string } },
  ) {
    const deleted = await this.policyService.softDelete(
      req.tenantId,
      req.user.id,
      id,
    );
    if (!deleted) {
      throw new NotFoundException(`Policy ${id} not found`);
    }
  }
}
