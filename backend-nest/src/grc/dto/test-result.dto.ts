import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  IsArray,
  IsObject,
  Matches,
} from 'class-validator';
import { TestResultOutcome, EffectivenessRating } from '../enums';

export class CreateTestResultDto {
  @IsUUID()
  controlTestId: string;

  @IsEnum(TestResultOutcome)
  result: TestResultOutcome;

  @IsOptional()
  @IsString()
  resultDetails?: string;

  @IsOptional()
  @IsString()
  exceptionsNoted?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  exceptionsCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sampleTested?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  samplePassed?: number;

  @IsOptional()
  @IsEnum(EffectivenessRating)
  effectivenessRating?: EffectivenessRating;

  @IsOptional()
  @IsString()
  recommendations?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  evidenceIds?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateTestResultDto {
  @IsOptional()
  @IsEnum(TestResultOutcome)
  result?: TestResultOutcome;

  @IsOptional()
  @IsString()
  resultDetails?: string;

  @IsOptional()
  @IsString()
  exceptionsNoted?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  exceptionsCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sampleTested?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  samplePassed?: number;

  @IsOptional()
  @IsEnum(EffectivenessRating)
  effectivenessRating?: EffectivenessRating;

  @IsOptional()
  @IsString()
  recommendations?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  evidenceIds?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ReviewTestResultDto {
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}

export class TestResultFilterDto {
  @IsOptional()
  @IsUUID()
  controlTestId?: string;

  @IsOptional()
  @IsEnum(TestResultOutcome)
  result?: TestResultOutcome;

  @IsOptional()
  @IsEnum(EffectivenessRating)
  effectivenessRating?: EffectivenessRating;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z_]+:(ASC|DESC|asc|desc)$/, {
    message: 'sort must be in format "field:ASC" or "field:DESC"',
  })
  sort?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';
}
