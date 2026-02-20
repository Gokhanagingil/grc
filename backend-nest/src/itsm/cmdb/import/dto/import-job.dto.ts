import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUUID,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ImportJobStatus } from '../cmdb-import-job.entity';
import { PaginationQueryDto } from '../../../../grc/dto/pagination.dto';

export class CreateImportJobDto {
  @IsUUID()
  @IsOptional()
  sourceId?: string;

  @IsBoolean()
  @IsOptional()
  dryRun?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  rows: Record<string, unknown>[];
}

export class ImportJobFilterDto extends PaginationQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  q?: string;

  @IsEnum(ImportJobStatus)
  @IsOptional()
  status?: ImportJobStatus;
}

export class ImportRowFilterDto extends PaginationQueryDto {
  @IsString()
  @IsOptional()
  status?: string;
}

export class ReconcileResultFilterDto extends PaginationQueryDto {
  @IsString()
  @IsOptional()
  action?: string;
}
