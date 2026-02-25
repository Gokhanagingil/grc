/**
 * Advisory Draft Mapper
 *
 * Centralized, type-safe mapping layer between advisory suggestion semantics
 * and target domain record DTOs (CAPA, ControlTest, Change, Task).
 *
 * ROOT CAUSE FIX: The advisory heuristics engine produces templateData with
 * UPPERCASE semantic labels (e.g. "CORRECTIVE", "PREVENTIVE") for CAPA types,
 * but the domain CapaType enum uses lowercase DB values ("corrective", "preventive", "both").
 * This mapper bridges that gap with compile-time safety and runtime validation.
 *
 * If enums change in the future, TypeScript exhaustiveness checks and the
 * validation functions here will produce compile/test failures to catch mismatches.
 */

import { CapaType, CAPAPriority } from '../enums';
import { SuggestedRecord, SuggestedRecordType } from './dto/advisory.dto';

// ============================================================================
// Advisory CAPA Semantic Types
// ============================================================================

/**
 * Semantic CAPA type labels used by the advisory heuristics engine.
 * These are the values found in suggestedRecord.templateData.type.
 *
 * IMPORTANT: These are NOT the same as the DB enum values.
 * The heuristics engine uses UPPERCASE semantic labels for clarity,
 * while the DB enum (CapaType) uses lowercase values.
 */
export enum AdvisoryCapaSemantic {
  CORRECTIVE = 'CORRECTIVE',
  PREVENTIVE = 'PREVENTIVE',
  CORRECTIVE_PREVENTIVE = 'CORRECTIVE_PREVENTIVE',
  BOTH = 'BOTH',
}

// ============================================================================
// Mapping: Advisory CAPA semantic -> Domain CapaType
// ============================================================================

/**
 * Maps advisory CAPA semantic labels to valid CapaType enum values.
 *
 * Rationale for each mapping:
 * - CORRECTIVE -> CapaType.CORRECTIVE ('corrective') — direct 1:1 match
 * - PREVENTIVE -> CapaType.PREVENTIVE ('preventive') — direct 1:1 match
 * - CORRECTIVE_PREVENTIVE -> CapaType.BOTH ('both') — combined type maps to BOTH
 * - BOTH -> CapaType.BOTH ('both') — explicit alias
 */
const ADVISORY_CAPA_TYPE_MAP: Record<AdvisoryCapaSemantic, CapaType> = {
  [AdvisoryCapaSemantic.CORRECTIVE]: CapaType.CORRECTIVE,
  [AdvisoryCapaSemantic.PREVENTIVE]: CapaType.PREVENTIVE,
  [AdvisoryCapaSemantic.CORRECTIVE_PREVENTIVE]: CapaType.BOTH,
  [AdvisoryCapaSemantic.BOTH]: CapaType.BOTH,
};

/**
 * Resolves a CAPA type from advisory templateData to a valid CapaType enum value.
 *
 * Accepts:
 * - Known UPPERCASE semantics: "CORRECTIVE", "PREVENTIVE", "CORRECTIVE_PREVENTIVE", "BOTH"
 * - Known lowercase DB values: "corrective", "preventive", "both"
 * - Mixed case variants (normalized to uppercase for lookup)
 *
 * Returns null if the input cannot be resolved, allowing callers to handle gracefully.
 */
export function resolveCapaType(advisoryTypeValue: unknown): CapaType | null {
  if (
    typeof advisoryTypeValue !== 'string' ||
    advisoryTypeValue.trim() === ''
  ) {
    return CapaType.CORRECTIVE; // Default for missing type
  }

  const normalized = advisoryTypeValue.trim().toUpperCase();

  // Check advisory semantic map first
  if (normalized in ADVISORY_CAPA_TYPE_MAP) {
    return ADVISORY_CAPA_TYPE_MAP[normalized as AdvisoryCapaSemantic];
  }

  // Check if it's already a valid CapaType value (lowercase DB values)
  const validCapaTypes = Object.values(CapaType) as string[];
  const lowered = advisoryTypeValue.trim().toLowerCase();
  if (validCapaTypes.includes(lowered)) {
    return lowered as CapaType;
  }

  // Unknown value — return null so caller can handle
  return null;
}

// ============================================================================
// Mapping: Advisory priority -> Domain CAPAPriority
// ============================================================================

/**
 * Maps advisory priority strings to valid CAPAPriority enum values.
 * CAPAPriority uses UPPERCASE values (HIGH, MEDIUM, LOW, CRITICAL).
 */
export function resolveCapaPriority(
  advisoryPriority: string | undefined,
): CAPAPriority {
  if (!advisoryPriority) return CAPAPriority.MEDIUM;

  const normalized = advisoryPriority.trim().toUpperCase();

  switch (normalized) {
    case 'HIGH':
      return CAPAPriority.HIGH;
    case 'MEDIUM':
      return CAPAPriority.MEDIUM;
    case 'LOW':
      return CAPAPriority.LOW;
    case 'CRITICAL':
      return CAPAPriority.CRITICAL;
    default:
      return CAPAPriority.MEDIUM;
  }
}

// ============================================================================
// Validation helpers
// ============================================================================

/**
 * Validates that a CapaType value is a member of the CapaType enum.
 * Use this as a final guard before persistence to prevent DB enum mismatch errors.
 */
export function isValidCapaType(value: unknown): value is CapaType {
  return Object.values(CapaType).includes(value as CapaType);
}

/**
 * Validates that a CAPAPriority value is a member of the CAPAPriority enum.
 */
export function isValidCapaPriority(value: unknown): value is CAPAPriority {
  return Object.values(CAPAPriority).includes(value as CAPAPriority);
}

// ============================================================================
// Draft Creation DTO Builder
// ============================================================================

export interface AdvisoryCapaDraftPayload {
  title: string;
  description: string;
  type: CapaType;
  priority: CAPAPriority;
  metadata: {
    advisorySource: string;
    suggestedRecordId: string;
    advisoryRecordType: string;
  };
}

/**
 * Resolves the effective target type for a suggested record.
 *
 * SuggestedRecordType.TASK items are routed to CAPA creation in the current
 * architecture (there is no standalone Task entity in the GRC domain).
 * This function makes that mapping explicit for error attribution.
 */
export function resolveEffectiveTargetType(
  suggestedType: SuggestedRecordType,
): SuggestedRecordType {
  switch (suggestedType) {
    case SuggestedRecordType.TASK:
      // Tasks are created as CAPAs in the current domain model
      return SuggestedRecordType.CAPA;
    case SuggestedRecordType.CAPA:
    case SuggestedRecordType.CHANGE:
    case SuggestedRecordType.CONTROL_TEST:
      return suggestedType;
    default:
      return suggestedType;
  }
}

/**
 * Builds a validated CAPA draft payload from an advisory suggested record.
 *
 * Returns either a valid payload or a structured validation error.
 * This ensures no invalid enum values reach the repository save layer.
 */
export function buildCapaDraftPayload(
  suggestedRecord: SuggestedRecord,
  titleOverride?: string,
  descriptionOverride?: string,
):
  | { payload: AdvisoryCapaDraftPayload }
  | { error: string; errorCode: string } {
  const title = titleOverride || suggestedRecord.title;
  const description = descriptionOverride || suggestedRecord.description;

  // Resolve CAPA type from templateData
  const resolvedType = resolveCapaType(suggestedRecord.templateData?.type);

  if (resolvedType === null) {
    return {
      error:
        `Unsupported CAPA type: "${String(suggestedRecord.templateData?.type)}". ` +
        `Valid types are: corrective, preventive, both.`,
      errorCode: 'INVALID_CAPA_TYPE',
    };
  }

  // Final validation guard — should never fail if resolveCapaType is correct,
  // but provides defense-in-depth against future regressions
  if (!isValidCapaType(resolvedType)) {
    return {
      error: `Internal mapping error: resolved CAPA type "${String(resolvedType)}" is not a valid enum value.`,
      errorCode: 'CAPA_TYPE_MAPPING_ERROR',
    };
  }

  const resolvedPriority = resolveCapaPriority(suggestedRecord.priority);

  if (!isValidCapaPriority(resolvedPriority)) {
    return {
      error: `Internal mapping error: resolved priority "${String(resolvedPriority)}" is not a valid enum value.`,
      errorCode: 'CAPA_PRIORITY_MAPPING_ERROR',
    };
  }

  return {
    payload: {
      title,
      description,
      type: resolvedType,
      priority: resolvedPriority,
      metadata: {
        advisorySource: 'risk-advisory-pack-v1',
        suggestedRecordId: suggestedRecord.id,
        advisoryRecordType: suggestedRecord.type,
      },
    },
  };
}
