import {
  IsOptional,
  IsBoolean,
  IsString,
  IsNumber,
  IsArray,
  IsIn,
  Min,
  Max,
} from 'class-validator';

export class UpsertAiSuggestionsPolicyDto {
  @IsOptional()
  @IsBoolean()
  aiSuggestionsEnabled?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['STUB', 'REAL'])
  providerMode?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedActionTypes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedInputFields?: string[];

  @IsOptional()
  @IsBoolean()
  requiresConfirm?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(60)
  rateLimitPerUserPerMinute?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rateLimitPerTenantPerDay?: number;

  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(3600)
  cacheTtlSeconds?: number;
}

export class GenerateAiAdviceDto {
  @IsOptional()
  @IsBoolean()
  refresh?: boolean;
}

export class QueryAiActivityLogDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  actionType?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  pageSize?: number;
}
