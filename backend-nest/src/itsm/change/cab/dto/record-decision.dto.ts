import { IsString, IsOptional, IsEnum } from 'class-validator';
import { CabDecisionStatus } from '../cab-agenda-item.entity';

export class RecordDecisionDto {
  @IsEnum(CabDecisionStatus)
  decisionStatus: string;

  @IsOptional()
  @IsString()
  decisionNote?: string;

  @IsOptional()
  @IsString()
  conditions?: string;
}
