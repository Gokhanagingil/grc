/**
 * RCA Orchestration DTOs
 *
 * Request/response contracts for creating Problem, Known Error,
 * and PIR Action records from MI RCA topology hypotheses.
 * Phase-C, Phase 2: MI RCA → Problem / KE / PIR orchestration.
 */
import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  MaxLength,
  IsDateString,
} from 'class-validator';
import {
  ProblemCategory,
  ProblemImpact,
  ProblemUrgency,
} from '../../../../enums';
import { PirActionPriority } from '../../../../pir/pir.enums';

// ============================================================================
// Source traceability metadata (shared across all orchestration actions)
// ============================================================================

/**
 * Traceability source type — always TOPOLOGY_RCA_HYPOTHESIS for Phase 2 actions.
 */
export type RcaSourceType = 'TOPOLOGY_RCA_HYPOTHESIS';

/**
 * Compact traceability metadata attached to records created from hypotheses.
 */
export interface RcaTraceabilityMeta {
  sourceType: RcaSourceType;
  /** The hypothesis ID that triggered this creation */
  sourceHypothesisId: string;
  /** The major incident ID context */
  sourceMajorIncidentId: string;
  /** The suspect node label for quick reference */
  suspectNodeLabel: string;
  /** The suspect node type */
  suspectNodeType: string;
  /** The hypothesis type/rule */
  hypothesisType: string;
  /** Confidence score at the time of creation */
  hypothesisScore: number;
}

// ============================================================================
// Create Problem from Hypothesis
// ============================================================================

export class CreateProblemFromHypothesisDto {
  @IsUUID()
  majorIncidentId: string;

  @IsString()
  hypothesisId: string;

  @IsString()
  @MaxLength(255)
  shortDescription: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ProblemCategory)
  category?: ProblemCategory;

  @IsOptional()
  @IsEnum(ProblemImpact)
  impact?: ProblemImpact;

  @IsOptional()
  @IsEnum(ProblemUrgency)
  urgency?: ProblemUrgency;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  assignmentGroup?: string;
}

// ============================================================================
// Create Known Error from Hypothesis
// ============================================================================

export class CreateKnownErrorFromHypothesisDto {
  @IsUUID()
  majorIncidentId: string;

  @IsString()
  hypothesisId: string;

  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  symptoms?: string;

  @IsOptional()
  @IsString()
  rootCause?: string;

  @IsOptional()
  @IsString()
  workaround?: string;

  @IsOptional()
  @IsUUID()
  problemId?: string;
}

// ============================================================================
// Create PIR Action from Hypothesis
// ============================================================================

export class CreatePirActionFromHypothesisDto {
  @IsUUID()
  majorIncidentId: string;

  @IsString()
  hypothesisId: string;

  @IsUUID()
  pirId: string;

  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(PirActionPriority)
  priority?: PirActionPriority;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

// ============================================================================
// Orchestration Response envelope (wraps created record + traceability)
// ============================================================================

export interface RcaOrchestrationResult<T> {
  /** The created record */
  record: T;
  /** Traceability metadata that was persisted */
  traceability: RcaTraceabilityMeta;
  /** Human-readable summary of what was created */
  summary: string;
}
