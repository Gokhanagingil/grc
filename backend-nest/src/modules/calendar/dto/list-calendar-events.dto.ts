import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsDateString,
  IsArray,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CalendarEventType, CalendarEventStatus } from '../../../entities/app/calendar-event.entity';

export class ListCalendarEventsDto {
  @ApiProperty({
    example: '2025-01-01T00:00:00Z',
    description: 'Start date (ISO 8601) - events from this date onwards',
  })
  @IsDateString()
  from!: string;

  @ApiProperty({
    example: '2025-12-31T23:59:59Z',
    description: 'End date (ISO 8601) - events up to this date',
  })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional({
    example: 'AUDIT_ENGAGEMENT,BCP_EXERCISE',
    enum: CalendarEventType,
    isArray: true,
    description: 'Filter by event types (comma-separated string or array)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    return [value];
  })
  @IsArray()
  @IsEnum(CalendarEventType, { each: true })
  types?: CalendarEventType[];

  @ApiPropertyOptional({
    example: 'PLANNED,CONFIRMED',
    enum: CalendarEventStatus,
    isArray: true,
    description: 'Filter by event statuses (comma-separated string or array)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    return [value];
  })
  @IsArray()
  @IsEnum(CalendarEventStatus, { each: true })
  status?: CalendarEventStatus[];

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Filter by owner user ID',
  })
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}

