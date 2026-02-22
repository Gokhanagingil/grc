/**
 * RCA Hypothesis Decision DTOs
 *
 * DTOs for managing hypothesis status decisions (accept/reject/investigate),
 * analyst notes, and selected hypothesis tracking.
 *
 * Phase C: MI RCA Actions & Evidence
 */
import {
  IsString,
  IsEnum,
  IsOptional,
  MaxLength,
  IsUUID,
} from 'class-validator';

// ---------------------------------------------------------------------------
// Hypothesis Decision Status
// ---------------------------------------------------------------------------

export enum HypothesisDecisionStatus {
  /** No decision made yet */
  PENDING = 'PENDING',
  /** Analyst accepted this hypothesis as the root cause */
  ACCEPTED = 'ACCEPTED',
  /** Analyst rejected this hypothesis */
  REJECTED = 'REJECTED',
  /** Hypothesis is under active investigation */
  NEEDS_INVESTIGATION = 'NEEDS_INVESTIGATION',
}

// ---------------------------------------------------------------------------
// Update Decision DTO
// ---------------------------------------------------------------------------

export class UpdateHypothesisDecisionDto {
  @IsEnum(HypothesisDecisionStatus)
  status: HypothesisDecisionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

// ---------------------------------------------------------------------------
// Add Analyst Note DTO
// ---------------------------------------------------------------------------

export class AddHypothesisNoteDto {
  @IsString()
  @MaxLength(4000)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  noteType?: string; // e.g. 'evidence', 'observation', 'conclusion', 'general'
}

// ---------------------------------------------------------------------------
// Set Selected Hypothesis DTO
// ---------------------------------------------------------------------------

export class SetSelectedHypothesisDto {
  @IsUUID()
  hypothesisId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

// ---------------------------------------------------------------------------
// Response interfaces (not class-validated, used for API responses)
// ---------------------------------------------------------------------------

export interface HypothesisNoteResponse {
  id: string;
  content: string;
  noteType: string;
  createdBy: string;
  createdAt: string;
}

export interface HypothesisDecisionResponse {
  hypothesisId: string;
  majorIncidentId: string;
  status: HypothesisDecisionStatus;
  reason: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  notes: HypothesisNoteResponse[];
}

export interface RcaDecisionsSummaryResponse {
  majorIncidentId: string;
  decisions: HypothesisDecisionResponse[];
  selectedHypothesisId: string | null;
  selectedReason: string | null;
  selectedBy: string | null;
  selectedAt: string | null;
  totalDecisions: number;
  acceptedCount: number;
  rejectedCount: number;
  investigatingCount: number;
  pendingCount: number;
}
