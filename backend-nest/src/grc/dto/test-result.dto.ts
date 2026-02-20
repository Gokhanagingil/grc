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
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TestResultOutcome,
  EffectivenessRating,
  TestMethod,
  TestResultStatus,
} from '../enums';

/**
 * CreateTestResultDto - DTO for creating a new test result
 *
 * Test/Result Sprint: Now supports direct control linkage without requiring a ControlTest.
 * Either controlTestId OR controlId should be provided.
 */
export class CreateTestResultDto {
  @IsOptional()
  @IsUUID()
  controlTestId?: string;

  // Test/Result Sprint - Direct control reference
  @IsOptional()
  @IsUUID()
  controlId?: string;

  @IsEnum(TestResultOutcome)
  result: TestResultOutcome;

  // Test/Result Sprint - Test date (required for new test results)
  @IsOptional()
  @IsDateString()
  testDate?: string;

  // Test/Result Sprint - Test method
  @IsOptional()
  @IsEnum(TestMethod)
  method?: TestMethod;

  // Test/Result Sprint - Status (draft/final)
  @IsOptional()
  @IsEnum(TestResultStatus)
  status?: TestResultStatus;

  // Test/Result Sprint - Summary text
  @IsOptional()
  @IsString()
  summary?: string;

  // Test/Result Sprint - Owner user
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

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

  // Test/Result Sprint - Test date
  @IsOptional()
  @IsDateString()
  testDate?: string;

  // Test/Result Sprint - Test method
  @IsOptional()
  @IsEnum(TestMethod)
  method?: TestMethod;

  // Test/Result Sprint - Status (draft/final)
  @IsOptional()
  @IsEnum(TestResultStatus)
  status?: TestResultStatus;

  // Test/Result Sprint - Summary text
  @IsOptional()
  @IsString()
  summary?: string;

  // Test/Result Sprint - Owner user
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

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

/**
 * TestResultFilterDto - List Contract v1 compliant filter DTO
 *
 * Supports:
 * - page/pageSize for pagination
 * - q for text search (summary, method, result)
 * - filter by: result, method, status, controlId, testDate ranges
 * - sort allowlist: testDate, result, method, status, createdAt, updatedAt
 */
export class TestResultFilterDto {
  @IsOptional()
  @IsUUID()
  controlTestId?: string;

  // Test/Result Sprint - Direct control filter
  @IsOptional()
  @IsUUID()
  controlId?: string;

  @IsOptional()
  @IsEnum(TestResultOutcome)
  result?: TestResultOutcome;

  // Test/Result Sprint - Method filter
  @IsOptional()
  @IsEnum(TestMethod)
  method?: TestMethod;

  // Test/Result Sprint - Status filter
  @IsOptional()
  @IsEnum(TestResultStatus)
  status?: TestResultStatus;

  @IsOptional()
  @IsEnum(EffectivenessRating)
  effectivenessRating?: EffectivenessRating;

  // Test/Result Sprint - Date range filters
  @IsOptional()
  @IsDateString()
  testDateAfter?: string;

  @IsOptional()
  @IsDateString()
  testDateBefore?: string;

  // List Contract v1 - Text search
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
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
