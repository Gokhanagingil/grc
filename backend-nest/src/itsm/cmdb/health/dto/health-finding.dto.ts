import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../grc/dto/pagination.dto';
import { FindingStatus } from '../cmdb-health-finding.entity';
import { HealthRuleSeverity } from '../cmdb-health-rule.entity';

export class WaiveFindingDto {
  @IsString()
  @MaxLength(1000)
  reason: string;
}

export class FindingFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(FindingStatus)
  status?: FindingStatus;

  @IsOptional()
  @IsString()
  ruleId?: string;

  @IsOptional()
  @IsString()
  ciId?: string;

  @IsOptional()
  @IsEnum(HealthRuleSeverity)
  severity?: HealthRuleSeverity;
}
