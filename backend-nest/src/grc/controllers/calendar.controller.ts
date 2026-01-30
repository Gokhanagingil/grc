import {
  Controller,
  Get,
  Query,
  Headers,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenants/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { Permissions } from '../../auth/permissions/permissions.decorator';
import { Permission } from '../../auth/permissions/permission.enum';
import { CalendarService, CalendarEvent } from '../services/calendar.service';
import { CalendarEventSourceType } from '../enums';

@ApiTags('Calendar')
@ApiBearerAuth()
@ApiHeader({ name: 'x-tenant-id', description: 'Tenant ID', required: true })
@Controller('grc/calendar')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('events')
  @Permissions(Permission.GRC_RISK_READ)
  @ApiOperation({ summary: 'Get calendar events from multiple sources' })
  @ApiQuery({
    name: 'start',
    required: true,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'end',
    required: true,
    description: 'End date (ISO format)',
  })
  @ApiQuery({
    name: 'types',
    required: false,
    description: 'Comma-separated event types to include',
  })
  @ApiQuery({
    name: 'ownerUserId',
    required: false,
    description: 'Filter by owner user ID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status',
  })
  @ApiResponse({ status: 200, description: 'List of calendar events' })
  @ApiResponse({ status: 400, description: 'Invalid parameters' })
  async getEvents(
    @Headers('x-tenant-id') tenantId: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('types') typesParam?: string,
    @Query('ownerUserId') ownerUserId?: string,
    @Query('status') status?: string,
  ): Promise<{ success: boolean; data: CalendarEvent[] }> {
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    if (!start || !end) {
      throw new BadRequestException(
        'start and end query parameters are required',
      );
    }

    let types: CalendarEventSourceType[] | undefined;
    if (typesParam) {
      const typeStrings = typesParam
        .split(',')
        .map((t) => t.trim().toUpperCase());
      const validTypes = Object.values(CalendarEventSourceType);
      types = typeStrings.filter((t) =>
        validTypes.includes(t as CalendarEventSourceType),
      ) as CalendarEventSourceType[];
    }

    const events = await this.calendarService.getEvents({
      tenantId,
      start,
      end,
      types,
      ownerUserId,
      status,
    });

    return {
      success: true,
      data: events,
    };
  }
}
