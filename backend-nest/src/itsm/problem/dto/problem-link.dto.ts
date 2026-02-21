import { IsEnum, IsOptional } from 'class-validator';
import { ProblemIncidentLinkType, ProblemChangeLinkType } from '../../enums';

/**
 * DTO for linking an incident to a problem
 */
export class LinkIncidentDto {
  @IsEnum(ProblemIncidentLinkType, { message: 'Invalid link type' })
  @IsOptional()
  linkType?: ProblemIncidentLinkType;
}

/**
 * DTO for linking a change to a problem
 */
export class LinkChangeDto {
  @IsEnum(ProblemChangeLinkType, { message: 'Invalid relation type' })
  @IsOptional()
  relationType?: ProblemChangeLinkType;
}
