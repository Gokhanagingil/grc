import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsOptional,
  IsNumber,
  IsArray,
} from 'class-validator';

const EVENT_TYPES = [
  'SUGGESTION_SHOWN',
  'SUGGESTION_APPLIED',
  'SUGGESTION_REJECTED',
] as const;

export class CreateLearningEventDto {
  @IsString()
  @IsNotEmpty()
  incidentSysId: string;

  @IsIn(EVENT_TYPES)
  eventType: (typeof EVENT_TYPES)[number];

  @IsString()
  @IsNotEmpty()
  actionType: string;

  @IsOptional()
  @IsNumber()
  confidence?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceIds?: string[];
}
