import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsEnum,
  IsObject,
  MaxLength,
} from 'class-validator';
import {
  ProcessControlMethod,
  ProcessControlFrequency,
  ControlResultType,
} from '../enums';

/**
 * Create ProcessControl DTO
 *
 * Validates payload for creating a new process control.
 * Required fields: processId, name
 * Optional fields: description, isAutomated, method, frequency, expectedResultType, parameters, isActive, ownerUserId
 */
export class CreateProcessControlDto {
  @IsUUID('4', { message: 'Process ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Process ID is required' })
  processId: string;

  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(255, { message: 'Name must not exceed 255 characters' })
  name: string;

  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @IsBoolean({ message: 'isAutomated must be a boolean' })
  @IsOptional()
  isAutomated?: boolean;

  @IsEnum(ProcessControlMethod, { message: 'Invalid method value' })
  @IsOptional()
  method?: ProcessControlMethod;

  @IsEnum(ProcessControlFrequency, { message: 'Invalid frequency value' })
  @IsOptional()
  frequency?: ProcessControlFrequency;

  @IsEnum(ControlResultType, { message: 'Invalid expectedResultType value' })
  @IsOptional()
  expectedResultType?: ControlResultType;

  @IsObject({ message: 'Parameters must be an object' })
  @IsOptional()
  parameters?: Record<string, unknown>;

  @IsBoolean({ message: 'isActive must be a boolean' })
  @IsOptional()
  isActive?: boolean;

  @IsUUID('4', { message: 'Owner user ID must be a valid UUID' })
  @IsOptional()
  ownerUserId?: string;
}
