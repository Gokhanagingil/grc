import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
  IsObject,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ChangeType, ChangeRisk } from '../change.entity';

export class CreateChangeDto {
  @IsString()
  @IsNotEmpty({ message: 'Change title is required' })
  @MaxLength(255)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ChangeType)
  @IsOptional()
  type?: ChangeType;

  @IsEnum(ChangeRisk)
  @IsOptional()
  risk?: ChangeRisk;

  @IsUUID('4')
  @IsOptional()
  requesterId?: string;

  @IsUUID('4')
  @IsOptional()
  assigneeId?: string;

  @IsUUID('4')
  @IsOptional()
  serviceId?: string;

  @IsUUID('4')
  @IsOptional()
  offeringId?: string;

  @IsUUID('4')
  @IsOptional()
  customerCompanyId?: string;

  @IsDateString()
  @IsOptional()
  plannedStartAt?: string;

  @IsDateString()
  @IsOptional()
  plannedEndAt?: string;

  @IsString()
  @IsOptional()
  implementationPlan?: string;

  @IsString()
  @IsOptional()
  backoutPlan?: string;

  @IsString()
  @IsOptional()
  justification?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
