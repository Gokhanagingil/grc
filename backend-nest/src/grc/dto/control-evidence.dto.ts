import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';
import { ControlEvidenceType } from '../enums';

export class CreateControlEvidenceDto {
  @IsUUID()
  controlId: string;

  @IsUUID()
  evidenceId: string;

  @IsOptional()
  @IsEnum(ControlEvidenceType)
  evidenceType?: ControlEvidenceType;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateControlEvidenceDto {
  @IsOptional()
  @IsEnum(ControlEvidenceType)
  evidenceType?: ControlEvidenceType;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ControlEvidenceFilterDto {
  @IsOptional()
  @IsUUID()
  controlId?: string;

  @IsOptional()
  @IsUUID()
  evidenceId?: string;

  @IsOptional()
  @IsEnum(ControlEvidenceType)
  evidenceType?: ControlEvidenceType;

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
