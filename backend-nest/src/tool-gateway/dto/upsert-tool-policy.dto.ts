import {
  IsBoolean,
  IsOptional,
  IsArray,
  IsString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class UpsertToolPolicyDto {
  @IsBoolean()
  isToolsEnabled: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedTools?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  rateLimitPerMinute?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxToolCallsPerRun?: number;
}
