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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiCreatedResponse,
  ApiParam,
} from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { ListCalendarEventsDto } from './dto/list-calendar-events.dto';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { CalendarEventEntity } from '../../entities/app/calendar-event.entity';

@ApiTags('calendar')
@ApiBearerAuth()
@Controller({ path: 'calendar', version: '2' })
@UseGuards(TenantGuard)
export class CalendarController {
  constructor(private readonly service: CalendarService) {}

  @Get('events')
  @ApiOperation({
    summary: 'List calendar events',
    description: 'Get calendar events within a date range, optionally filtered by type, status, or owner',
  })
  @ApiOkResponse({
    description: 'List of calendar events',
    type: [CalendarEventEntity],
  })
  async listEvents(
    @Query() query: ListCalendarEventsDto,
    @Tenant() tenantId: string,
  ): Promise<CalendarEventEntity[]> {
    return this.service.list(query, tenantId);
  }

  @Post('events')
  @ApiOperation({
    summary: 'Create calendar event',
    description: 'Create a new calendar event (manual entry, e.g., maintenance window)',
  })
  @ApiCreatedResponse({
    description: 'Created calendar event',
    type: CalendarEventEntity,
  })
  @HttpCode(HttpStatus.CREATED)
  async createEvent(
    @Body() dto: CreateCalendarEventDto,
    @Tenant() tenantId: string,
  ): Promise<CalendarEventEntity> {
    return this.service.create(dto, tenantId);
  }

  @Get('events/:id')
  @ApiOperation({
    summary: 'Get calendar event',
    description: 'Get a single calendar event by ID',
  })
  @ApiParam({ name: 'id', description: 'Calendar event ID' })
  @ApiOkResponse({
    description: 'Calendar event details',
    type: CalendarEventEntity,
  })
  async getEvent(
    @Param('id') id: string,
    @Tenant() tenantId: string,
  ): Promise<CalendarEventEntity> {
    return this.service.getById(id, tenantId);
  }

  @Patch('events/:id')
  @ApiOperation({
    summary: 'Update calendar event',
    description: 'Update an existing calendar event',
  })
  @ApiParam({ name: 'id', description: 'Calendar event ID' })
  @ApiOkResponse({
    description: 'Updated calendar event',
    type: CalendarEventEntity,
  })
  async updateEvent(
    @Param('id') id: string,
    @Body() dto: UpdateCalendarEventDto,
    @Tenant() tenantId: string,
  ): Promise<CalendarEventEntity> {
    return this.service.update(id, dto, tenantId);
  }

  @Delete('events/:id')
  @ApiOperation({
    summary: 'Delete calendar event',
    description: 'Delete a calendar event',
  })
  @ApiParam({ name: 'id', description: 'Calendar event ID' })
  @ApiOkResponse({ description: 'Event deleted successfully' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEvent(
    @Param('id') id: string,
    @Tenant() tenantId: string,
  ): Promise<void> {
    return this.service.delete(id, tenantId);
  }
}

