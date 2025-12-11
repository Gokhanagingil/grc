import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsEnum,
  IsNumber,
  IsDate,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ControlResultSource } from '../enums';

/**
 * Create ControlResult DTO
 *
 * Validates payload for creating a new control result.
 * Required fields: controlId, isCompliant
 * The result value field depends on the control's expectedResultType:
 * - BOOLEAN: resultValueBoolean
 * - NUMERIC: resultValueNumber
 * - QUALITATIVE: resultValueText
 */
export class CreateControlResultDto {
  @IsUUID('4', { message: 'Control ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Control ID is required' })
  controlId: string;

  @Type(() => Date)
  @IsDate({ message: 'Execution date must be a valid date' })
  @IsOptional()
  executionDate?: Date;

  @IsUUID('4', { message: 'Executor user ID must be a valid UUID' })
  @IsOptional()
  executorUserId?: string;

  @IsEnum(ControlResultSource, { message: 'Invalid source value' })
  @IsOptional()
  source?: ControlResultSource;

  @IsBoolean({ message: 'resultValueBoolean must be a boolean' })
  @IsOptional()
  resultValueBoolean?: boolean;

  @IsNumber({}, { message: 'resultValueNumber must be a number' })
  @IsOptional()
  resultValueNumber?: number;

  @IsString({ message: 'resultValueText must be a string' })
  @IsOptional()
  resultValueText?: string;

  @IsBoolean({ message: 'isCompliant must be a boolean' })
  @IsNotEmpty({ message: 'isCompliant is required' })
  isCompliant: boolean;

  @IsString({ message: 'Evidence reference must be a string' })
  @IsOptional()
  @MaxLength(500, { message: 'Evidence reference must not exceed 500 characters' })
  evidenceReference?: string;
}
