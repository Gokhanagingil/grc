import {
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsUUID,
  IsObject,
} from 'class-validator';
import {
  PropagationPolicy,
  PropagationWeight,
  RuleDirection,
} from '../ci-class-relationship-rule.entity';

export class CreateClassRelationshipRuleDto {
  @IsUUID()
  @IsNotEmpty()
  sourceClassId: string;

  @IsUUID()
  @IsNotEmpty()
  relationshipTypeId: string;

  @IsUUID()
  @IsNotEmpty()
  targetClassId: string;

  @IsEnum(RuleDirection)
  @IsOptional()
  direction?: RuleDirection;

  @IsEnum(PropagationPolicy)
  @IsOptional()
  propagationOverride?: PropagationPolicy;

  @IsEnum(PropagationWeight)
  @IsOptional()
  propagationWeight?: PropagationWeight;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
