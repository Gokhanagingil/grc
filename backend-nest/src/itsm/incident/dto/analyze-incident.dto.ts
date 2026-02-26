import { IsOptional, IsIn, IsString } from 'class-validator';

/**
 * DTO for triggering incident AI analysis
 */
export class AnalyzeIncidentDto {
  @IsOptional()
  @IsIn(['quick', 'standard'])
  depth?: 'quick' | 'standard';

  @IsOptional()
  @IsIn(['professional', 'calm', 'transparent'])
  tone?: 'professional' | 'calm' | 'transparent';

  @IsOptional()
  @IsString()
  externalSysId?: string;
}
