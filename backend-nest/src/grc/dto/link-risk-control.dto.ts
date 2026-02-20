import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { ControlEffectiveness } from '../enums';

/**
 * Link Risk Control DTO
 *
 * Validates payload for linking a control to a risk.
 * Optional fields: effectivenessRating, overrideEffectivenessPercent, notes
 */
export class LinkRiskControlDto {
  @IsEnum(ControlEffectiveness, {
    message: 'Invalid effectiveness rating value',
  })
  @IsOptional()
  effectivenessRating?: ControlEffectiveness;

  @IsInt({ message: 'Override effectiveness percent must be an integer' })
  @Min(0, { message: 'Override effectiveness percent must be at least 0' })
  @Max(100, { message: 'Override effectiveness percent must be at most 100' })
  @IsOptional()
  overrideEffectivenessPercent?: number | null;

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

  @IsInt({ message: 'Override effectiveness percent must be an integer' })
  @Min(0, { message: 'Override effectiveness percent must be at least 0' })
  @Max(100, { message: 'Override effectiveness percent must be at most 100' })
  @IsOptional()
  overrideEffectivenessPercent?: number | null;

  @IsString({ message: 'Notes must be a string' })
  @IsOptional()
  notes?: string;
}

/**
 * Update Risk Control Effectiveness Override DTO
 *
 * Validates payload for updating only the effectiveness override on a risk-control link.
 * Used by PATCH /grc/risks/:riskId/controls/:controlId/effectiveness-override
 */
export class UpdateEffectivenessOverrideDto {
  @IsInt({ message: 'Override effectiveness percent must be an integer' })
  @Min(0, { message: 'Override effectiveness percent must be at least 0' })
  @Max(100, { message: 'Override effectiveness percent must be at most 100' })
  @IsOptional()
  overrideEffectivenessPercent?: number | null;
}
