import { IsArray, IsUUID } from 'class-validator';

/**
 * Link Risks to ProcessControl DTO
 *
 * Used for linking/replacing risks associated with a process control.
 */
export class LinkRisksToControlDto {
  @IsArray({ message: 'Risk IDs must be an array' })
  @IsUUID('4', { each: true, message: 'Each risk ID must be a valid UUID' })
  riskIds: string[];
}
