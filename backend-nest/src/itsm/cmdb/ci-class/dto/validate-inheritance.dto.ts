import { IsUUID, IsOptional } from 'class-validator';

/**
 * DTO for validating a proposed inheritance change.
 * If parentClassId is null or omitted, validates becoming a root class.
 */
export class ValidateInheritanceDto {
  @IsUUID('4')
  @IsOptional()
  parentClassId?: string | null;
}
