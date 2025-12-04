/**
 * GRC Domain Enumerations
 *
 * All enums used across GRC entities for consistent typing and validation.
 */

// Risk Enums
export enum RiskSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum RiskLikelihood {
  RARE = 'rare',
  UNLIKELY = 'unlikely',
  POSSIBLE = 'possible',
  LIKELY = 'likely',
  ALMOST_CERTAIN = 'almost_certain',
}

export enum RiskStatus {
  DRAFT = 'draft',
  IDENTIFIED = 'identified',
  ASSESSED = 'assessed',
  MITIGATING = 'mitigating',
  ACCEPTED = 'accepted',
  CLOSED = 'closed',
}

// Control Enums
export enum ControlType {
  PREVENTIVE = 'preventive',
  DETECTIVE = 'detective',
  CORRECTIVE = 'corrective',
}

export enum ControlImplementationType {
  MANUAL = 'manual',
  AUTOMATED = 'automated',
  IT_DEPENDENT = 'it_dependent',
}

export enum ControlStatus {
  DRAFT = 'draft',
  IN_DESIGN = 'in_design',
  IMPLEMENTED = 'implemented',
  INOPERATIVE = 'inoperative',
  RETIRED = 'retired',
}

export enum ControlFrequency {
  CONTINUOUS = 'continuous',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
}

// Policy Enums
export enum PolicyStatus {
  DRAFT = 'draft',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  ACTIVE = 'active',
  RETIRED = 'retired',
}

// Issue Enums
export enum IssueType {
  INTERNAL_AUDIT = 'internal_audit',
  EXTERNAL_AUDIT = 'external_audit',
  INCIDENT = 'incident',
  SELF_ASSESSMENT = 'self_assessment',
  OTHER = 'other',
}

export enum IssueStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  REJECTED = 'rejected',
}

export enum IssueSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// CAPA Enums
export enum CapaType {
  CORRECTIVE = 'corrective',
  PREVENTIVE = 'preventive',
  BOTH = 'both',
}

export enum CapaStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  IMPLEMENTED = 'implemented',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  CLOSED = 'closed',
}

// Evidence Enums
export enum EvidenceType {
  DOCUMENT = 'document',
  SCREENSHOT = 'screenshot',
  LOG = 'log',
  REPORT = 'report',
  CONFIG_EXPORT = 'config_export',
  OTHER = 'other',
}

// Compliance Framework Enum
export enum ComplianceFramework {
  ISO27001 = 'iso27001',
  SOC2 = 'soc2',
  GDPR = 'gdpr',
  HIPAA = 'hipaa',
  PCI_DSS = 'pci_dss',
  NIST = 'nist',
  OTHER = 'other',
}

// Mapping relationship types
export enum RelationshipType {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
}

export enum CoverageLevel {
  FULL = 'full',
  PARTIAL = 'partial',
  MINIMAL = 'minimal',
}
