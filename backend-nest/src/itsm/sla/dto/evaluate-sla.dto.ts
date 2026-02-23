import { IsString, IsOptional, IsObject, IsUUID } from 'class-validator';

/**
 * DTO for evaluating SLA policy match against a record context.
 * Used by the evaluate / preview endpoint.
 */
export class EvaluateSlaDto {
  @IsOptional()
  @IsString()
  recordType?: string;

  @IsOptional()
  @IsUUID()
  incidentId?: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}

/**
 * DTO for server-side condition tree validation.
 */
export class ValidateConditionTreeDto {
  @IsObject()
  conditionTree: Record<string, unknown>;

  @IsOptional()
  @IsString()
  recordType?: string;
}
