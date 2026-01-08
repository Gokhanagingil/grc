import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  MaxLength,
  IsObject,
} from 'class-validator';
import { ControlTestType, ControlTestStatus } from '../enums';

export class CreateControlTestDto {
  @IsUUID()
  controlId: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ControlTestType)
  testType?: ControlTestType;

  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @IsOptional()
  @IsUUID()
  testerUserId?: string;

  @IsOptional()
  @IsUUID()
  reviewerUserId?: string;

  @IsOptional()
  @IsString()
  testProcedure?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sampleSize?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  populationSize?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateControlTestDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ControlTestType)
  testType?: ControlTestType;

  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @IsOptional()
  @IsUUID()
  testerUserId?: string;

  @IsOptional()
  @IsUUID()
  reviewerUserId?: string;

  @IsOptional()
  @IsString()
  testProcedure?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sampleSize?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  populationSize?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateControlTestStatusDto {
  @IsEnum(ControlTestStatus)
  status: ControlTestStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ControlTestFilterDto {
  @IsOptional()
  @IsUUID()
  controlId?: string;

  @IsOptional()
  @IsEnum(ControlTestStatus)
  status?: ControlTestStatus;

  @IsOptional()
  @IsEnum(ControlTestType)
  testType?: ControlTestType;

  @IsOptional()
  @IsUUID()
  testerUserId?: string;

  @IsOptional()
  @IsDateString()
  scheduledDateFrom?: string;

  @IsOptional()
  @IsDateString()
  scheduledDateTo?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';
}
