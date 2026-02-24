import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { PirActionPriority } from '../pir.enums';

/**
 * DTO for creating a PIR Action item
 */
export class CreatePirActionDto {
  @IsUUID()
  pirId: string;

  @IsString()
  @MaxLength(255)
  title: string;

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
