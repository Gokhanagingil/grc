import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';

/**
 * DTO for linking policies to a risk
 */
export class LinkPoliciesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  policyIds: string[];
}
