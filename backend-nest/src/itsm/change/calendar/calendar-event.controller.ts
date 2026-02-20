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
import { CalendarEventService } from './calendar-event.service';
import { CalendarEventFilterDto } from './dto/calendar-event-filter.dto';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { PreviewConflictsDto } from './dto/preview-conflicts.dto';
import { ConflictDetectionService } from './conflict-detection.service';

@Controller('grc/itsm/calendar/events')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CalendarEventController {
  constructor(
    private readonly calendarEventService: CalendarEventService,
    private readonly conflictDetectionService: ConflictDetectionService,
  ) {}

  @Get()
  @Permissions(Permission.ITSM_CALENDAR_READ)
  @Perf()
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filterDto: CalendarEventFilterDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.calendarEventService.findAll(tenantId, filterDto);
  }

  @Post()
  @Permissions(Permission.ITSM_CALENDAR_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @Perf()
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateCalendarEventDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.calendarEventService.create(tenantId, req.user.id, {
      title: dto.title,
      type: dto.type,
      status: dto.status,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
      changeId: dto.changeId || null,
    });
  }

  @Post('preview-conflicts')
  @Permissions(Permission.ITSM_CALENDAR_READ)
  @HttpCode(HttpStatus.OK)
  @Perf()
  async previewConflicts(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: PreviewConflictsDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    return this.conflictDetectionService.previewConflicts(
      tenantId,
      new Date(dto.startAt),
      new Date(dto.endAt),
      dto.changeId,
      dto.serviceId,
    );
  }

  @Get(':id')
  @Permissions(Permission.ITSM_CALENDAR_READ)
  @Perf()
  async findOne(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const event = await this.calendarEventService.findById(tenantId, id);
    if (!event) {
      throw new NotFoundException(`Calendar event ${id} not found`);
    }
    return event;
  }

  @Patch(':id')
  @Permissions(Permission.ITSM_CALENDAR_WRITE)
  @Perf()
  async update(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateCalendarEventDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }
    const event = await this.calendarEventService.update(
      tenantId,
      req.user.id,
      id,
      {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.startAt ? { startAt: new Date(dto.startAt) } : {}),
        ...(dto.endAt ? { endAt: new Date(dto.endAt) } : {}),
      },
    );
    if (!event) {
      throw new NotFoundException(`Calendar event ${id} not found`);
    }
    return event;
  }

  @Delete(':id')
  @Permissions(Permission.ITSM_CALENDAR_WRITE)
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
    const deleted = await this.calendarEventService.softDelete(
      tenantId,
      req.user.id,
      id,
    );
    if (!deleted) {
      throw new NotFoundException(`Calendar event ${id} not found`);
    }
  }
}
