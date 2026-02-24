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
import { Perf } from '../../../common/decorators';
import { CabMeetingService } from './cab-meeting.service';
import { CreateCabMeetingDto } from './dto/create-cab-meeting.dto';
import { UpdateCabMeetingDto } from './dto/update-cab-meeting.dto';
import { CabMeetingFilterDto } from './dto/cab-meeting-filter.dto';
import { AddAgendaItemDto } from './dto/add-agenda-item.dto';
import { RecordDecisionDto } from './dto/record-decision.dto';
import { ReorderAgendaDto } from './dto/reorder-agenda.dto';

@Controller('grc/itsm/cab-meetings')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CabMeetingController {
  constructor(private readonly cabMeetingService: CabMeetingService) {}

  // ──────────────────────────────────────────────
  // Meeting CRUD
  // ──────────────────────────────────────────────

  @Get()
  @Permissions(Permission.ITSM_CAB_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: CabMeetingFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.cabMeetingService.findAll(tenantId, filterDto);
  }

  @Post()
  @Permissions(Permission.ITSM_CAB_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateCabMeetingDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.cabMeetingService.create(tenantId, req.user.id, {
      title: dto.title,
      meetingAt: new Date(dto.meetingAt),
      endAt: dto.endAt ? new Date(dto.endAt) : null,
      status: dto.status,
      chairpersonId: dto.chairpersonId || null,
      notes: dto.notes || null,
      summary: dto.summary || null,
    });
  }

  @Get(':id')
  @Permissions(Permission.ITSM_CAB_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const meeting = await this.cabMeetingService.findById(tenantId, id);
    if (!meeting) {
      throw new NotFoundException(`CAB meeting ${id} not found`);
    }
    return meeting;
  }

  @Patch(':id')
  @Permissions(Permission.ITSM_CAB_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateCabMeetingDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const meeting = await this.cabMeetingService.update(
      tenantId,
      req.user.id,
      id,
      {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.meetingAt ? { meetingAt: new Date(dto.meetingAt) } : {}),
        ...(dto.endAt !== undefined
          ? { endAt: dto.endAt ? new Date(dto.endAt) : null }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.chairpersonId !== undefined
          ? { chairpersonId: dto.chairpersonId }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.summary !== undefined ? { summary: dto.summary } : {}),
      },
    );
    if (!meeting) {
      throw new NotFoundException(`CAB meeting ${id} not found`);
    }
    return meeting;
  }

  @Delete(':id')
  @Permissions(Permission.ITSM_CAB_WRITE)
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
    const deleted = await this.cabMeetingService.softDelete(
      tenantId,
      req.user.id,
      id,
    );
    if (!deleted) {
      throw new NotFoundException(`CAB meeting ${id} not found`);
    }
  }

  // ──────────────────────────────────────────────
  // Agenda Management
  // ──────────────────────────────────────────────

  @Get(':id/agenda')
  @Permissions(Permission.ITSM_CAB_READ)
  @Perf()
  async listAgenda(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.cabMeetingService.listAgenda(tenantId, id);
  }

  @Post(':id/agenda')
  @Permissions(Permission.ITSM_CAB_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async addAgendaItem(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: AddAgendaItemDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    // Verify meeting exists
    const meeting = await this.cabMeetingService.findById(tenantId, id);
    if (!meeting) {
      throw new NotFoundException(`CAB meeting ${id} not found`);
    }
    return this.cabMeetingService.addAgendaItem(
      tenantId,
      req.user.id,
      id,
      dto.changeId,
      dto.orderIndex,
    );
  }

  @Delete(':id/agenda/:itemId')
  @Permissions(Permission.ITSM_CAB_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Perf()
  async removeAgendaItem(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const removed = await this.cabMeetingService.removeAgendaItem(
      tenantId,
      req.user.id,
      id,
      itemId,
    );
    if (!removed) {
      throw new NotFoundException(`Agenda item ${itemId} not found`);
    }
  }

  @Post(':id/agenda/reorder')
  @Permissions(Permission.ITSM_CAB_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async reorderAgenda(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: ReorderAgendaDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.cabMeetingService.reorderAgenda(
      tenantId,
      req.user.id,
      id,
      dto.itemIds,
    );
  }

  // ──────────────────────────────────────────────
  // Decision Recording
  // ──────────────────────────────────────────────

  @Post(':id/agenda/:itemId/decision')
  @Permissions(Permission.ITSM_CAB_WRITE)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async recordDecision(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: RecordDecisionDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const item = await this.cabMeetingService.recordDecision(
      tenantId,
      req.user.id,
      id,
      itemId,
      dto.decisionStatus,
      dto.decisionNote,
      dto.conditions,
    );
    if (!item) {
      throw new NotFoundException(`Agenda item ${itemId} not found`);
    }
    return item;
  }
}
