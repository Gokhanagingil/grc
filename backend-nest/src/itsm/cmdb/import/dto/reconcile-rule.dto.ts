import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsUUID,
  IsObject,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../../grc/dto/pagination.dto';

export class CreateReconcileRuleDto {
  @IsString()
  name: string;

  @IsUUID()
  @IsOptional()
  targetClassId?: string;

  @IsObject()
  matchStrategy: Record<string, unknown>;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  precedence?: number;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class UpdateReconcileRuleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsUUID()
  @IsOptional()
  targetClassId?: string;

  @IsObject()
  @IsOptional()
  matchStrategy?: Record<string, unknown>;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  precedence?: number;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class ReconcileRuleFilterDto extends PaginationQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  q?: string;
}
