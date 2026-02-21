import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { MajorIncidentStatus, MajorIncidentSeverity } from '../major-incident.enums';

export const MI_SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'number',
  'title',
  'status',
  'severity',
  'declaredAt',
  'resolvedAt',
];

/**
 * DTO for filtering and paginating Major Incidents
 */
export class MajorIncidentFilterDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: string;

  @IsOptional()
  @IsEnum(MajorIncidentStatus)
  status?: MajorIncidentStatus;

  @IsOptional()
  @IsEnum(MajorIncidentSeverity)
  severity?: MajorIncidentSeverity;

  @IsOptional()
  @IsString()
  commanderId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  createdFrom?: string;

  @IsOptional()
  @IsString()
  createdTo?: string;
}
