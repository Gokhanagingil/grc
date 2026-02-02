import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ControlEffectiveness } from '../enums';

/**
 * Link Risk Control DTO
 *
 * Validates payload for linking a control to a risk.
 * Optional fields: effectivenessRating, notes
 */
export class LinkRiskControlDto {
  @IsEnum(ControlEffectiveness, {
    message: 'Invalid effectiveness rating value',
  })
  @IsOptional()
  effectivenessRating?: ControlEffectiveness;

  @IsString({ message: 'Notes must be a string' })
  @IsOptional()
  notes?: string;
}

/**
 * Update Risk Control Link DTO
 *
 * Validates payload for updating a risk-control link.
 * All fields are optional for PATCH semantics.
 */
export class UpdateRiskControlLinkDto {
  @IsEnum(ControlEffectiveness, {
    message: 'Invalid effectiveness rating value',
  })
  @IsOptional()
  effectivenessRating?: ControlEffectiveness;

  @IsString({ message: 'Notes must be a string' })
  @IsOptional()
  notes?: string;
}
