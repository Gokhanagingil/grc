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
export function calculatePriority(
  impact: IncidentImpact,
  urgency: IncidentUrgency,
): IncidentPriority {
  const matrix: Record<IncidentImpact, Record<IncidentUrgency, IncidentPriority>> = {
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
