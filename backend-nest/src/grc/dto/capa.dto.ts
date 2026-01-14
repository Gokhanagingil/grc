import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  IsObject,
  MaxLength,
  IsArray,
  Matches,
} from 'class-validator';
import { CapaType, CapaStatus, CAPAPriority } from '../enums';

/**
 * DTO for creating a new CAPA record
 */
export class CreateCapaDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  issueId: string;

  @IsOptional()
  @IsEnum(CapaType)
  type?: CapaType;

  @IsOptional()
  @IsEnum(CapaStatus)
  status?: CapaStatus;

  @IsOptional()
  @IsEnum(CAPAPriority)
  priority?: CAPAPriority;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  rootCauseAnalysis?: string;

  @IsOptional()
  @IsString()
  actionPlan?: string;

  @IsOptional()
  @IsString()
  implementationNotes?: string;

  @IsOptional()
  @IsString()
  verificationMethod?: string;

  @IsOptional()
  @IsString()
  verificationNotes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for updating an existing CAPA record
 */
export class UpdateCapaDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CapaType)
  type?: CapaType;

  @IsOptional()
  @IsEnum(CAPAPriority)
  priority?: CAPAPriority;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  completedDate?: string;

  @IsOptional()
  @IsString()
  rootCauseAnalysis?: string;

  @IsOptional()
  @IsString()
  actionPlan?: string;

  @IsOptional()
  @IsString()
  implementationNotes?: string;

  @IsOptional()
  @IsString()
  verificationMethod?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  verificationEvidenceIds?: string[];

  @IsOptional()
  @IsString()
  verificationNotes?: string;

  @IsOptional()
  @IsString()
  closureNotes?: string;

  @IsOptional()
  @IsString()
  effectiveness?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for filtering CAPA list queries
 */
export class CapaFilterDto {
  @IsOptional()
  @IsEnum(CapaStatus)
  status?: CapaStatus;

  @IsOptional()
  @IsEnum(CapaType)
  type?: CapaType;

  @IsOptional()
  @IsEnum(CAPAPriority)
  priority?: CAPAPriority;

  @IsOptional()
  @IsUUID()
  issueId?: string;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  search?: string;

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
  @Matches(/^[a-zA-Z_]+:(ASC|DESC|asc|desc)$/, {
    message: 'sort must be in format "field:ASC" or "field:DESC"',
  })
  sort?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';
}
