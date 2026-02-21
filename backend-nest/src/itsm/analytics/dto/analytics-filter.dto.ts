import { IsOptional, IsString, IsDateString } from 'class-validator';

/**
 * Analytics Filter DTO
 *
 * Common filter parameters for all analytics endpoints.
 * Tenant ID comes from the x-tenant-id header (not query).
 */
export class AnalyticsFilterDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  team?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  category?: string;
}
