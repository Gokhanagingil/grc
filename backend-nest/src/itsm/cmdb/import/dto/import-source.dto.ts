import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject,
  IsInt,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ImportSourceType } from '../cmdb-import-source.entity';
import { PaginationQueryDto } from '../../../../grc/dto/pagination.dto';

export class CreateImportSourceDto {
  @IsString()
  name: string;

  @IsEnum(ImportSourceType)
  @IsOptional()
  type?: ImportSourceType;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  scheduleEnabled?: boolean;

  @IsString()
  @IsOptional()
  @Matches(
    /^[0-9*,\-/]+\s+[0-9*,\-/]+\s+[0-9*,\-/]+\s+[0-9*,\-/]+\s+[0-9*,\-/]+$/,
    {
      message: 'cronExpr must be a valid 5-field cron expression',
    },
  )
  cronExpr?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(1440)
  @Type(() => Number)
  maxRunsPerDay?: number;

  @IsBoolean()
  @IsOptional()
  dryRunByDefault?: boolean;
}

export class UpdateImportSourceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(ImportSourceType)
  @IsOptional()
  type?: ImportSourceType;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  scheduleEnabled?: boolean;

  @IsString()
  @IsOptional()
  @Matches(
    /^[0-9*,\-/]+\s+[0-9*,\-/]+\s+[0-9*,\-/]+\s+[0-9*,\-/]+\s+[0-9*,\-/]+$/,
    {
      message: 'cronExpr must be a valid 5-field cron expression',
    },
  )
  cronExpr?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(1440)
  @Type(() => Number)
  maxRunsPerDay?: number;

  @IsBoolean()
  @IsOptional()
  dryRunByDefault?: boolean;
}

export class ImportSourceFilterDto extends PaginationQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  q?: string;
}
