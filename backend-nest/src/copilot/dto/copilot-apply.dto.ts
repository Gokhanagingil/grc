import { IsString, IsIn, IsNotEmpty, MaxLength } from 'class-validator';

const ALLOWED_TARGET_FIELDS = ['work_notes', 'additional_comments'] as const;
export type AllowedTargetField = (typeof ALLOWED_TARGET_FIELDS)[number];

export class CopilotApplyDto {
  @IsString()
  @IsNotEmpty()
  actionType: string;

  @IsIn(ALLOWED_TARGET_FIELDS, {
    message: 'targetField must be work_notes or additional_comments',
  })
  targetField: AllowedTargetField;

  @IsString()
  @IsNotEmpty()
  @MaxLength(65000)
  text: string;
}

export interface CopilotApplyResponse {
  success: boolean;
  incidentSysId: string;
  targetField: AllowedTargetField;
  appliedAt: string;
}
