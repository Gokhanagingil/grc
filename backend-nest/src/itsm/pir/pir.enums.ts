/**
 * PIR (Post-Incident Review) Status Lifecycle
 *
 * Flow: DRAFT → IN_REVIEW → APPROVED → CLOSED
 */
export enum PirStatus {
  DRAFT = 'DRAFT',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  CLOSED = 'CLOSED',
}

/**
 * PIR Action Status
 */
export enum PirActionStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

/**
 * PIR Action Priority
 */
export enum PirActionPriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

/**
 * Knowledge Candidate Status
 */
export enum KnowledgeCandidateStatus {
  DRAFT = 'DRAFT',
  REVIEWED = 'REVIEWED',
  PUBLISHED = 'PUBLISHED',
  REJECTED = 'REJECTED',
}

/**
 * Knowledge Candidate Source Type
 */
export enum KnowledgeCandidateSourceType {
  PIR = 'PIR',
  KNOWN_ERROR = 'KNOWN_ERROR',
  PROBLEM = 'PROBLEM',
}

/**
 * Valid PIR status transitions
 */
export const PIR_TRANSITIONS: Record<PirStatus, PirStatus[]> = {
  [PirStatus.DRAFT]: [PirStatus.IN_REVIEW],
  [PirStatus.IN_REVIEW]: [PirStatus.APPROVED, PirStatus.DRAFT],
  [PirStatus.APPROVED]: [PirStatus.CLOSED],
  [PirStatus.CLOSED]: [],
};

/**
 * Valid Knowledge Candidate status transitions
 */
export const KC_TRANSITIONS: Record<
  KnowledgeCandidateStatus,
  KnowledgeCandidateStatus[]
> = {
  [KnowledgeCandidateStatus.DRAFT]: [
    KnowledgeCandidateStatus.REVIEWED,
    KnowledgeCandidateStatus.REJECTED,
  ],
  [KnowledgeCandidateStatus.REVIEWED]: [
    KnowledgeCandidateStatus.PUBLISHED,
    KnowledgeCandidateStatus.REJECTED,
    KnowledgeCandidateStatus.DRAFT,
  ],
  [KnowledgeCandidateStatus.PUBLISHED]: [],
  [KnowledgeCandidateStatus.REJECTED]: [KnowledgeCandidateStatus.DRAFT],
};

/**
 * Check if a PIR status transition is valid
 */
export function isValidPirTransition(from: PirStatus, to: PirStatus): boolean {
  return PIR_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Check if a Knowledge Candidate status transition is valid
 */
export function isValidKcTransition(
  from: KnowledgeCandidateStatus,
  to: KnowledgeCandidateStatus,
): boolean {
  return KC_TRANSITIONS[from]?.includes(to) ?? false;
}
