import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

/**
 * Reopen Problem DTO
 *
 * Validates payload for reopening a resolved/closed problem.
 * Requires a reason for audit trail.
 */
export class ReopenProblemDto {
  @IsString({ message: 'Reason must be a string' })
  @IsNotEmpty({ message: 'Reason is required when reopening a problem' })
  @MaxLength(1000, { message: 'Reason must not exceed 1000 characters' })
  reason: string;
}
