/**
 * Major Incident Status - Lifecycle states for major incident coordination
 *
 * Flow: DECLARED → INVESTIGATING → MITIGATING → MONITORING → RESOLVED → PIR_PENDING → CLOSED
 */
export enum MajorIncidentStatus {
  DECLARED = 'DECLARED',
  INVESTIGATING = 'INVESTIGATING',
  MITIGATING = 'MITIGATING',
  MONITORING = 'MONITORING',
  RESOLVED = 'RESOLVED',
  PIR_PENDING = 'PIR_PENDING',
  CLOSED = 'CLOSED',
}

/**
 * Major Incident Severity
 */
export enum MajorIncidentSeverity {
  SEV1 = 'SEV1',
  SEV2 = 'SEV2',
  SEV3 = 'SEV3',
}

/**
 * Major Incident Update Type - Types of timeline updates
 */
export enum MajorIncidentUpdateType {
  STATUS_CHANGE = 'STATUS_CHANGE',
  STAKEHOLDER_UPDATE = 'STAKEHOLDER_UPDATE',
  TECHNICAL_UPDATE = 'TECHNICAL_UPDATE',
  DECISION = 'DECISION',
  ESCALATION = 'ESCALATION',
  COMMUNICATION = 'COMMUNICATION',
  ACTION_TAKEN = 'ACTION_TAKEN',
  BRIDGE_NOTE = 'BRIDGE_NOTE',
}

/**
 * Major Incident Update Visibility
 */
export enum MajorIncidentUpdateVisibility {
  INTERNAL = 'INTERNAL',
  EXTERNAL = 'EXTERNAL',
}

/**
 * Major Incident Link Type - Types of linked records
 */
export enum MajorIncidentLinkType {
  INCIDENT = 'INCIDENT',
  CHANGE = 'CHANGE',
  PROBLEM = 'PROBLEM',
  CMDB_SERVICE = 'CMDB_SERVICE',
  CMDB_OFFERING = 'CMDB_OFFERING',
  CMDB_CI = 'CMDB_CI',
}

/**
 * Valid status transitions for major incidents.
 * Key = current status, Value = array of allowed next statuses
 */
export const MAJOR_INCIDENT_TRANSITIONS: Record<MajorIncidentStatus, MajorIncidentStatus[]> = {
  [MajorIncidentStatus.DECLARED]: [
    MajorIncidentStatus.INVESTIGATING,
  ],
  [MajorIncidentStatus.INVESTIGATING]: [
    MajorIncidentStatus.MITIGATING,
    MajorIncidentStatus.MONITORING,
    MajorIncidentStatus.RESOLVED,
  ],
  [MajorIncidentStatus.MITIGATING]: [
    MajorIncidentStatus.MONITORING,
    MajorIncidentStatus.INVESTIGATING,
    MajorIncidentStatus.RESOLVED,
  ],
  [MajorIncidentStatus.MONITORING]: [
    MajorIncidentStatus.RESOLVED,
    MajorIncidentStatus.INVESTIGATING,
    MajorIncidentStatus.MITIGATING,
  ],
  [MajorIncidentStatus.RESOLVED]: [
    MajorIncidentStatus.PIR_PENDING,
    MajorIncidentStatus.CLOSED,
    MajorIncidentStatus.INVESTIGATING, // reopen
  ],
  [MajorIncidentStatus.PIR_PENDING]: [
    MajorIncidentStatus.CLOSED,
  ],
  [MajorIncidentStatus.CLOSED]: [],
};

/**
 * Check if a status transition is valid
 */
export function isValidMajorIncidentTransition(
  from: MajorIncidentStatus,
  to: MajorIncidentStatus,
): boolean {
  const allowed = MAJOR_INCIDENT_TRANSITIONS[from];
  return allowed?.includes(to) ?? false;
}
