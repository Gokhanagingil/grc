/**
 * GRC Domain Enumerations
 *
 * All enums used across GRC entities for consistent typing and validation.
 * All enums are compatible with PostgreSQL enum types.
 */

// ============================================================================
// Common Enums (shared across multiple entity types)
// ============================================================================

/**
 * CommonStatus - Generic status enum for entities that follow a simple lifecycle
 */
export enum CommonStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

/**
 * AuditAction - Actions tracked in audit logs
 */
export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

// ============================================================================
// Risk Enums
// ============================================================================

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

// ============================================================================
// Control Enums
// ============================================================================

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

// ============================================================================
// Policy Enums
// ============================================================================

export enum PolicyStatus {
  DRAFT = 'draft',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  ACTIVE = 'active',
  RETIRED = 'retired',
}

/**
 * PolicyState - Alias for PolicyStatus for backward compatibility
 */
export const PolicyState = PolicyStatus;
export type PolicyState = PolicyStatus;

// ============================================================================
// Requirement Enums
// ============================================================================

/**
 * RequirementType - Types of compliance requirements
 */
export enum RequirementType {
  REGULATORY = 'regulatory',
  CONTRACTUAL = 'contractual',
  INTERNAL = 'internal',
  INDUSTRY_STANDARD = 'industry_standard',
  BEST_PRACTICE = 'best_practice',
}

/**
 * RequirementStatus - Status of compliance requirements
 */
export enum RequirementStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  IMPLEMENTED = 'implemented',
  VERIFIED = 'verified',
  NON_COMPLIANT = 'non_compliant',
}

// ============================================================================
// Issue Enums
// ============================================================================

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

// ============================================================================
// CAPA Enums
// ============================================================================

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

// ============================================================================
// Evidence Enums
// ============================================================================

export enum EvidenceType {
  DOCUMENT = 'document',
  SCREENSHOT = 'screenshot',
  LOG = 'log',
  REPORT = 'report',
  CONFIG_EXPORT = 'config_export',
  OTHER = 'other',
}

// ============================================================================
// Compliance Framework Enum
// ============================================================================

export enum ComplianceFramework {
  ISO27001 = 'iso27001',
  SOC2 = 'soc2',
  GDPR = 'gdpr',
  HIPAA = 'hipaa',
  PCI_DSS = 'pci_dss',
  NIST = 'nist',
  OTHER = 'other',
}

// ============================================================================
// Mapping Relationship Types
// ============================================================================

export enum RelationshipType {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
}

export enum CoverageLevel {
  FULL = 'full',
  PARTIAL = 'partial',
  MINIMAL = 'minimal',
}

// ============================================================================
// Policy Version Enums
// ============================================================================

/**
 * PolicyVersionStatus - Status of a policy version in its lifecycle
 */
export enum PolicyVersionStatus {
  DRAFT = 'draft',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  PUBLISHED = 'published',
  RETIRED = 'retired',
}

/**
 * VersionType - Type of version increment
 */
export enum VersionType {
  MAJOR = 'major',
  MINOR = 'minor',
}

// ============================================================================
// Audit Report Template Enums
// ============================================================================

/**
 * AuditStandard - Standards for audit report templates
 */
export enum AuditStandard {
  ISO27001 = 'iso27001',
  ISO22301 = 'iso22301',
  COBIT = 'cobit',
  SOC2 = 'soc2',
  NIST = 'nist',
  PCI_DSS = 'pci_dss',
  GDPR = 'gdpr',
  HIPAA = 'hipaa',
  CUSTOM = 'custom',
}

/**
 * TemplateLanguage - Supported languages for templates
 */
export enum TemplateLanguage {
  EN = 'en',
  TR = 'tr',
}

// ============================================================================
// Metadata System Enums
// ============================================================================

/**
 * ClassificationTagType - Types of classification tags
 */
export enum ClassificationTagType {
  PRIVACY = 'privacy',
  SECURITY = 'security',
  COMPLIANCE = 'compliance',
}

// ============================================================================
// Search/Query DSL Enums
// ============================================================================

/**
 * SearchEngine - Supported search engines
 */
export enum SearchEngine {
  POSTGRES = 'postgres',
  ELASTICSEARCH = 'elasticsearch',
}

/**
 * QueryOperator - Operators for query DSL conditions
 */
export enum QueryOperator {
  EQUALS = 'eq',
  NOT_EQUALS = 'neq',
  CONTAINS = 'contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  IN = 'in',
  NOT_IN = 'not_in',
  BETWEEN = 'between',
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUAL = 'lte',
  IS_NULL = 'is_null',
  IS_NOT_NULL = 'is_not_null',
}

/**
 * LogicalOperator - Logical operators for combining conditions
 */
export enum LogicalOperator {
  AND = 'AND',
  OR = 'OR',
}
