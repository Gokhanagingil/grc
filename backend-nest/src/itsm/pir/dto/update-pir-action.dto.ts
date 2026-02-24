import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { PirActionStatus, PirActionPriority } from '../pir.enums';

/**
 * DTO for updating a PIR Action item
 */
export class UpdatePirActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsEnum(PirActionStatus)
  status?: PirActionStatus;

  @IsOptional()
  @IsEnum(PirActionPriority)
  priority?: PirActionPriority;

  @IsOptional()
  @IsUUID()
  problemId?: string;

  @IsOptional()
  @IsUUID()
  changeId?: string;

  @IsOptional()
  @IsUUID()
  riskObservationId?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
