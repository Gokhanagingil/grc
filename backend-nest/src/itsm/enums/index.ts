/**
 * ITSM Domain Enumerations
 *
 * All enums used across ITSM entities for consistent typing and validation.
 * All enums are compatible with PostgreSQL enum types.
 */

// ============================================================================
// Incident Enums
// ============================================================================

/**
 * IncidentCategory - Types of incidents
 */
export enum IncidentCategory {
  HARDWARE = 'hardware',
  SOFTWARE = 'software',
  NETWORK = 'network',
  ACCESS = 'access',
  OTHER = 'other',
}

/**
 * IncidentImpact - Business impact level
 */
export enum IncidentImpact {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

/**
 * IncidentUrgency - Time sensitivity level
 */
export enum IncidentUrgency {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

/**
 * IncidentPriority - Calculated from impact/urgency matrix
 * P1 = Critical, P2 = High, P3 = Medium, P4 = Low
 */
export enum IncidentPriority {
  P1 = 'p1',
  P2 = 'p2',
  P3 = 'p3',
  P4 = 'p4',
}

/**
 * IncidentStatus - Incident lifecycle states
 */
export enum IncidentStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

/**
 * IncidentSource - How the incident was reported
 */
export enum IncidentSource {
  USER = 'user',
  MONITORING = 'monitoring',
  EMAIL = 'email',
  PHONE = 'phone',
  SELF_SERVICE = 'self_service',
}

/**
 * Calculate priority from impact and urgency using ITIL matrix
 *
 * | Impact \ Urgency | High | Medium | Low |
 * |------------------|------|--------|-----|
 * | High             | P1   | P2     | P3  |
 * | Medium           | P2   | P3     | P4  |
 * | Low              | P3   | P4     | P4  |
 */
// ============================================================================
// Problem Enums
// ============================================================================

/**
 * ProblemState - Problem lifecycle states (ITIL-aligned)
 */
export enum ProblemState {
  NEW = 'NEW',
  UNDER_INVESTIGATION = 'UNDER_INVESTIGATION',
  KNOWN_ERROR = 'KNOWN_ERROR',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

/**
 * ProblemPriority - Problem priority levels
 */
export enum ProblemPriority {
  P1 = 'P1',
  P2 = 'P2',
  P3 = 'P3',
  P4 = 'P4',
}

/**
 * ProblemImpact - Business impact level for problems
 */
export enum ProblemImpact {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

/**
 * ProblemUrgency - Time sensitivity for problems
 */
export enum ProblemUrgency {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

/**
 * ProblemCategory - Problem categories
 */
export enum ProblemCategory {
  HARDWARE = 'HARDWARE',
  SOFTWARE = 'SOFTWARE',
  NETWORK = 'NETWORK',
  SECURITY = 'SECURITY',
  DATABASE = 'DATABASE',
  APPLICATION = 'APPLICATION',
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  OTHER = 'OTHER',
}

/**
 * ProblemSource - How the problem was identified
 */
export enum ProblemSource {
  MANUAL = 'MANUAL',
  INCIDENT_CLUSTER = 'INCIDENT_CLUSTER',
  MONITORING = 'MONITORING',
  POSTMORTEM = 'POSTMORTEM',
  PROACTIVE = 'PROACTIVE',
}

/**
 * ProblemIncidentLinkType - Type of incident-problem relationship
 */
export enum ProblemIncidentLinkType {
  PRIMARY_SYMPTOM = 'PRIMARY_SYMPTOM',
  RELATED = 'RELATED',
  RECURRENCE = 'RECURRENCE',
}

/**
 * ProblemChangeLinkType - Type of change-problem relationship
 */
export enum ProblemChangeLinkType {
  INVESTIGATES = 'INVESTIGATES',
  WORKAROUND = 'WORKAROUND',
  PERMANENT_FIX = 'PERMANENT_FIX',
  ROLLBACK_RELATED = 'ROLLBACK_RELATED',
}

/**
 * RcaEntryType - Type of RCA entry
 */
export enum RcaEntryType {
  TIMELINE = 'TIMELINE',
  CONTRIBUTING_FACTOR = 'CONTRIBUTING_FACTOR',
  FIVE_WHYS = 'FIVE_WHYS',
  ROOT_CAUSE = 'ROOT_CAUSE',
  CORRECTIVE_ACTION = 'CORRECTIVE_ACTION',
  PREVENTIVE_ACTION = 'PREVENTIVE_ACTION',
  LESSON_LEARNED = 'LESSON_LEARNED',
}

/**
 * ProblemRiskLevel - Problem operational risk level
 */
export enum ProblemRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// ============================================================================
// Known Error Enums
// ============================================================================

/**
 * KnownErrorState - Known Error lifecycle states
 */
export enum KnownErrorState {
  DRAFT = 'DRAFT',
  VALIDATED = 'VALIDATED',
  PUBLISHED = 'PUBLISHED',
  RETIRED = 'RETIRED',
}

/**
 * RootCauseCategory - Categorization of root causes for structured RCA
 */
export enum RootCauseCategory {
  HUMAN_ERROR = 'HUMAN_ERROR',
  PROCESS_FAILURE = 'PROCESS_FAILURE',
  TECHNOLOGY_FAILURE = 'TECHNOLOGY_FAILURE',
  EXTERNAL_FACTOR = 'EXTERNAL_FACTOR',
  DESIGN_FLAW = 'DESIGN_FLAW',
  CAPACITY_ISSUE = 'CAPACITY_ISSUE',
  CHANGE_RELATED = 'CHANGE_RELATED',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  VENDOR_ISSUE = 'VENDOR_ISSUE',
  UNKNOWN = 'UNKNOWN',
}

/**
 * KnownErrorFixStatus - Permanent fix progress
 */
export enum KnownErrorFixStatus {
  NONE = 'NONE',
  WORKAROUND_AVAILABLE = 'WORKAROUND_AVAILABLE',
  FIX_IN_PROGRESS = 'FIX_IN_PROGRESS',
  FIX_DEPLOYED = 'FIX_DEPLOYED',
}

/**
 * Calculate problem priority from impact and urgency
 *
 * | Impact \ Urgency | High | Medium | Low |
 * |------------------|------|--------|-----|
 * | High             | P1   | P2     | P3  |
 * | Medium           | P2   | P3     | P4  |
 * | Low              | P3   | P4     | P4  |
 */
export function calculateProblemPriority(
  impact: ProblemImpact,
  urgency: ProblemUrgency,
): ProblemPriority {
  const matrix: Record<
    ProblemImpact,
    Record<ProblemUrgency, ProblemPriority>
  > = {
    [ProblemImpact.HIGH]: {
      [ProblemUrgency.HIGH]: ProblemPriority.P1,
      [ProblemUrgency.MEDIUM]: ProblemPriority.P2,
      [ProblemUrgency.LOW]: ProblemPriority.P3,
    },
    [ProblemImpact.MEDIUM]: {
      [ProblemUrgency.HIGH]: ProblemPriority.P2,
      [ProblemUrgency.MEDIUM]: ProblemPriority.P3,
      [ProblemUrgency.LOW]: ProblemPriority.P4,
    },
    [ProblemImpact.LOW]: {
      [ProblemUrgency.HIGH]: ProblemPriority.P3,
      [ProblemUrgency.MEDIUM]: ProblemPriority.P4,
      [ProblemUrgency.LOW]: ProblemPriority.P4,
    },
  };

  return matrix[impact][urgency];
}

export function calculatePriority(
  impact: IncidentImpact,
  urgency: IncidentUrgency,
): IncidentPriority {
  const matrix: Record<
    IncidentImpact,
    Record<IncidentUrgency, IncidentPriority>
  > = {
    [IncidentImpact.HIGH]: {
      [IncidentUrgency.HIGH]: IncidentPriority.P1,
      [IncidentUrgency.MEDIUM]: IncidentPriority.P2,
      [IncidentUrgency.LOW]: IncidentPriority.P3,
    },
    [IncidentImpact.MEDIUM]: {
      [IncidentUrgency.HIGH]: IncidentPriority.P2,
      [IncidentUrgency.MEDIUM]: IncidentPriority.P3,
      [IncidentUrgency.LOW]: IncidentPriority.P4,
    },
    [IncidentImpact.LOW]: {
      [IncidentUrgency.HIGH]: IncidentPriority.P3,
      [IncidentUrgency.MEDIUM]: IncidentPriority.P4,
      [IncidentUrgency.LOW]: IncidentPriority.P4,
    },
  };

  return matrix[impact][urgency];
}
