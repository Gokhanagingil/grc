import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';

/**
 * DTO for linking requirements to a risk
 */
export class LinkRequirementsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  requirementIds: string[];
}
