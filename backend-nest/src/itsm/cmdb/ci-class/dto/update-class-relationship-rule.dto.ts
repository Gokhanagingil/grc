import { IsOptional, IsBoolean, IsEnum, IsObject } from 'class-validator';
import {
  PropagationPolicy,
  PropagationWeight,
  RuleDirection,
} from '../ci-class-relationship-rule.entity';

export class UpdateClassRelationshipRuleDto {
  @IsEnum(RuleDirection)
  @IsOptional()
  direction?: RuleDirection;

  @IsEnum(PropagationPolicy)
  @IsOptional()
  propagationOverride?: PropagationPolicy | null;

  @IsEnum(PropagationWeight)
  @IsOptional()
  propagationWeight?: PropagationWeight | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
