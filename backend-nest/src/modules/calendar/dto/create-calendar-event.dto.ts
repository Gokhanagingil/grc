import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CalendarEventType, CalendarEventStatus } from '../../../entities/app/calendar-event.entity';

export class CreateCalendarEventDto {
  @ApiProperty({
    example: 'ISO 27001 Internal Audit Q1 2025',
    description: 'Event title',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

  @ApiPropertyOptional({
    example: 'Annual internal audit for ISO 27001 compliance',
    description: 'Event description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: CalendarEventType.AUDIT_ENGAGEMENT,
    enum: CalendarEventType,
    description: 'Event type',
  })
  @IsEnum(CalendarEventType)
  event_type!: CalendarEventType;

  @ApiPropertyOptional({
    example: 'audit',
    description: 'Source module (e.g., "audit", "bcm", "governance")',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  source_module?: string;

  @ApiPropertyOptional({
    example: 'AuditEngagement',
    description: 'Source entity name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source_entity?: string;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Source entity ID',
  })
  @IsOptional()
  @IsUUID()
  source_id?: string;

  @ApiProperty({
    example: '2025-03-01T09:00:00Z',
    description: 'Event start date/time (ISO 8601)',
  })
  @IsDateString()
  start_at!: string;

  @ApiPropertyOptional({
    example: '2025-03-05T17:00:00Z',
    description: 'Event end date/time (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  end_at?: string;

  @ApiPropertyOptional({
    example: CalendarEventStatus.PLANNED,
    enum: CalendarEventStatus,
    description: 'Event status',
    default: CalendarEventStatus.PLANNED,
  })
  @IsOptional()
  @IsEnum(CalendarEventStatus)
  status?: CalendarEventStatus;

  @ApiPropertyOptional({
    example: 'Conference Room A',
    description: 'Event location',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Owner user ID',
  })
  @IsOptional()
  @IsUUID()
  owner_user_id?: string;

  @ApiPropertyOptional({
    example: '#1976d2',
    description: 'Color hint (hex color code)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color_hint?: string;
}

