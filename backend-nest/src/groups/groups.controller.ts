import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request as NestRequest,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { Permissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permission.enum';
import { RequestWithUser } from '../common/types';
import { GroupsService } from './groups.service';
import { CreateGroupDto, UpdateGroupDto, AddMemberDto, QueryGroupsDto } from './dto';

@Controller('grc/groups')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  /**
   * List groups (read-only, any authenticated user).
   * Used by To-Do assignment group picker and other consumers.
   */
  @Get('directory')
  async directory(
    @NestRequest() req: RequestWithUser,
    @Query() query: QueryGroupsDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    const { items, total } = await this.groupsService.findAll(tenantId, query);
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    return {
      items: items.map((g) => ({ id: g.id, name: g.name, description: g.description, isActive: g.isActive })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  @Get()
  @Permissions(Permission.ADMIN_USERS_READ)
  async findAll(
    @NestRequest() req: RequestWithUser,
    @Query() query: QueryGroupsDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    const { items, total } = await this.groupsService.findAll(tenantId, query);
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  @Get(':id')
  @Permissions(Permission.ADMIN_USERS_READ)
  async findOne(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.groupsService.findOne(tenantId, id);
  }

  @Post()
  @Permissions(Permission.ADMIN_USERS_WRITE)
  async create(
    @NestRequest() req: RequestWithUser,
    @Body() dto: CreateGroupDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.groupsService.create(tenantId, dto);
  }

  @Put(':id')
  @Permissions(Permission.ADMIN_USERS_WRITE)
  async update(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.groupsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.ADMIN_USERS_WRITE)
  async remove(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    await this.groupsService.remove(tenantId, id);
    return { deleted: true };
  }

  /* ---- Membership endpoints ---- */

  @Get(':id/members')
  @Permissions(Permission.ADMIN_USERS_READ)
  async getMembers(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.groupsService.getMembers(tenantId, id);
  }

  @Post(':id/members')
  @Permissions(Permission.ADMIN_USERS_WRITE)
  async addMember(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    return this.groupsService.addMember(tenantId, id, dto.userId);
  }

  @Delete(':id/members/:userId')
  @Permissions(Permission.ADMIN_USERS_WRITE)
  async removeMember(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID required');
    await this.groupsService.removeMember(tenantId, id, userId);
    return { removed: true };
  }
}
