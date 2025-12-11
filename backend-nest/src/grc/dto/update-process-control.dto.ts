import {
  IsString,
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

export class UpdateProcessControlDto {
  @IsString({ message: 'Name must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'Name must not exceed 255 characters' })
  name?: string;

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
