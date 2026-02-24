import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsObject,
} from 'class-validator';
import { PolicyConditions, PolicyActions } from '../change-policy.entity';

export class UpdateChangePolicyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsObject()
  conditions?: PolicyConditions;

  @IsOptional()
  @IsObject()
  actions?: PolicyActions;
}
