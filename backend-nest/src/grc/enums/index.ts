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
  TREATMENT_PLANNED = 'treatment_planned',
  TREATING = 'treating',
  MITIGATING = 'mitigating',
  MONITORED = 'monitored',
  ACCEPTED = 'accepted',
  CLOSED = 'closed',
}

/**
 * RiskType - Classification of risk by domain
 * Values match PostgreSQL enum: grc_risks_risk_type_enum
 */
export enum RiskType {
  STRATEGIC = 'strategic',
  OPERATIONAL = 'operational',
  COMPLIANCE = 'compliance',
  FINANCIAL = 'financial',
  TECHNOLOGY = 'technology',
  CYBER = 'cyber',
  THIRD_PARTY = 'third_party',
  OTHER = 'other',
}

/**
 * RiskAppetite - Risk appetite band
 * Values match PostgreSQL enum: grc_risks_risk_appetite_enum
 */
export enum RiskAppetite {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

/**
 * TreatmentStrategy - Risk treatment strategy
 * Values match PostgreSQL enum: grc_risks_treatment_strategy_enum
 */
export enum TreatmentStrategy {
  AVOID = 'avoid',
  MITIGATE = 'mitigate',
  TRANSFER = 'transfer',
  ACCEPT = 'accept',
}

/**
 * AssessmentType - Type of risk assessment
 * Values match PostgreSQL enum: grc_risk_assessments_assessment_type_enum
 */
export enum AssessmentType {
  INHERENT = 'inherent',
  RESIDUAL = 'residual',
}

/**
 * ControlEffectiveness - Effectiveness of a control in mitigating risk
 * Values match PostgreSQL enum: grc_risk_controls_effectiveness_enum
 */
export enum ControlEffectiveness {
  UNKNOWN = 'unknown',
  EFFECTIVE = 'effective',
  PARTIALLY_EFFECTIVE = 'partially_effective',
  INEFFECTIVE = 'ineffective',
}

/**
 * RiskBand - Risk score band for heatmap visualization
 * Computed from score: 1-4 Low, 5-9 Medium, 10-15 High, 16-25 Critical
 */
export enum RiskBand {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
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

/**
 * IssueSource - How the issue was created
 * manual: Created manually by a user
 * test_result: Auto-created from a failing test result (Golden Flow)
 * soa_item: Created from an SOA item gap (SOA Closure Loop)
 */
export enum IssueSource {
  MANUAL = 'manual',
  TEST_RESULT = 'test_result',
  SOA_ITEM = 'soa_item',
}

/**
 * SourceType - Generic source type for tracking origin of entities
 * Used by Issue and CAPA to track where they were created from
 * Extensible for future source types
 */
export enum SourceType {
  SOA_ITEM = 'SOA_ITEM',
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
  LINK = 'link',
  OTHER = 'other',
}

/**
 * EvidenceSourceType - How the evidence was collected/sourced
 */
export enum EvidenceSourceType {
  MANUAL = 'manual',
  URL = 'url',
  SYSTEM = 'system',
}

/**
 * EvidenceStatus - Lifecycle status of evidence
 */
export enum EvidenceStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  RETIRED = 'retired',
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

// ============================================================================
// Process Controls Enums (Sprint 5)
// ============================================================================

/**
 * ProcessControlMethod - Methods for executing process controls
 */
export enum ProcessControlMethod {
  SCRIPT = 'script',
  SAMPLING = 'sampling',
  INTERVIEW = 'interview',
  WALKTHROUGH = 'walkthrough',
  OBSERVATION = 'observation',
}

/**
 * ProcessControlFrequency - How often a process control is executed
 */
export enum ProcessControlFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually',
  EVENT_DRIVEN = 'event_driven',
}

/**
 * ControlResultType - Expected result type for a process control
 */
export enum ControlResultType {
  BOOLEAN = 'boolean',
  NUMERIC = 'numeric',
  QUALITATIVE = 'qualitative',
}

/**
 * ControlResultSource - Source of a control result
 */
export enum ControlResultSource {
  MANUAL = 'manual',
  SCHEDULED_JOB = 'scheduled_job',
  INTEGRATION = 'integration',
}

/**
 * ViolationSeverity - Severity level of a process violation
 */
export enum ViolationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * ViolationStatus - Status of a process violation
 */
export enum ViolationStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
}

// ============================================================================
// Golden Flow Enums (Phase 1)
// ============================================================================

/**
 * ControlTestType - Type of control test execution
 * Values match PostgreSQL enum: grc_control_tests_test_type_enum
 */
export enum ControlTestType {
  MANUAL = 'MANUAL',
  AUTOMATED = 'AUTOMATED',
  HYBRID = 'HYBRID',
}

/**
 * ControlTestStatus - Status of a control test
 * Values match PostgreSQL enum: grc_control_tests_status_enum
 */
export enum ControlTestStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/**
 * TestResultOutcome - Outcome of a test result
 * Values match PostgreSQL enum: grc_test_results_result_enum
 */
export enum TestResultOutcome {
  PASS = 'PASS',
  FAIL = 'FAIL',
  INCONCLUSIVE = 'INCONCLUSIVE',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

/**
 * EffectivenessRating - Rating of control effectiveness
 * Values match PostgreSQL enum: grc_test_results_effectiveness_rating_enum
 */
export enum EffectivenessRating {
  EFFECTIVE = 'EFFECTIVE',
  PARTIALLY_EFFECTIVE = 'PARTIALLY_EFFECTIVE',
  INEFFECTIVE = 'INEFFECTIVE',
}

/**
 * CAPATaskStatus - Status of a CAPA task
 * Values match PostgreSQL enum: grc_capa_tasks_status_enum
 */
export enum CAPATaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/**
 * ControlEvidenceType - Type of evidence linked to a control
 * Values match PostgreSQL enum: grc_control_evidence_evidence_type_enum
 */
export enum ControlEvidenceType {
  BASELINE = 'BASELINE',
  TEST = 'TEST',
  PERIODIC = 'PERIODIC',
}

/**
 * CAPAPriority - Priority level for CAPA
 * Values match PostgreSQL enum: grc_capas_priority_enum
 */
export enum CAPAPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * StatusHistoryEntityType - Entity types tracked in status history
 */
export enum StatusHistoryEntityType {
  ISSUE = 'issue',
  CAPA = 'capa',
  CONTROL_TEST = 'control_test',
  CAPA_TASK = 'capa_task',
}

// ============================================================================
// Test Result Enums (Test/Result Sprint)
// ============================================================================

/**
 * TestMethod - Method used to conduct a test
 * Values match PostgreSQL enum: grc_test_results_method_enum
 */
export enum TestMethod {
  INTERVIEW = 'INTERVIEW',
  OBSERVATION = 'OBSERVATION',
  INSPECTION = 'INSPECTION',
  REPERFORMANCE = 'REPERFORMANCE',
  OTHER = 'OTHER',
}

/**
 * TestResultStatus - Status of a test result in its lifecycle
 * Values match PostgreSQL enum: grc_test_results_status_enum
 */
export enum TestResultStatus {
  DRAFT = 'DRAFT',
  FINAL = 'FINAL',
}

// ============================================================================
// Export Enums
// ============================================================================

/**
 * ExportEntity - Entities that can be exported as CSV
 * Used with ParseEnumPipe for input validation to prevent XSS attacks
 */
export enum ExportEntity {
  ISSUES = 'issues',
  ISSUE = 'issue',
  CAPAS = 'capas',
  CAPA = 'capa',
  EVIDENCE = 'evidence',
}

// ============================================================================
// Platform Builder Enums
// ============================================================================

/**
 * PlatformBuilderFieldType - Field types for dynamic table definitions in Platform Builder
 * Values match PostgreSQL enum: sys_dictionary_field_type_enum
 * Note: Named differently from DictionaryFieldType in data-model-dictionary.service.ts to avoid conflicts
 */
export enum PlatformBuilderFieldType {
  STRING = 'string',
  TEXT = 'text',
  INTEGER = 'integer',
  DECIMAL = 'decimal',
  BOOLEAN = 'boolean',
  DATE = 'date',
  DATETIME = 'datetime',
  CHOICE = 'choice',
  REFERENCE = 'reference',
}

// ============================================================================
// SOA (Statement of Applicability) Enums
// ============================================================================

/**
 * SoaProfileStatus - Status of an SOA profile in its lifecycle
 * Values match PostgreSQL enum: grc_soa_profiles_status_enum
 */
export enum SoaProfileStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

/**
 * SoaApplicability - Whether a clause is applicable to the organization
 * Values match PostgreSQL enum: grc_soa_items_applicability_enum
 */
export enum SoaApplicability {
  APPLICABLE = 'APPLICABLE',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  UNDECIDED = 'UNDECIDED',
}

/**
 * SoaImplementationStatus - Implementation status of an applicable clause
 * Values match PostgreSQL enum: grc_soa_items_implementation_status_enum
 */
export enum SoaImplementationStatus {
  IMPLEMENTED = 'IMPLEMENTED',
  PARTIALLY_IMPLEMENTED = 'PARTIALLY_IMPLEMENTED',
  PLANNED = 'PLANNED',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
}

// ============================================================================
// BCM (Business Continuity Management) Enums
// ============================================================================

/**
 * BcmServiceStatus - Status of a BCM service
 * Values match PostgreSQL enum: bcm_services_status_enum
 */
export enum BcmServiceStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

/**
 * BcmCriticalityTier - Criticality tier for BCM services and BIAs
 * Values match PostgreSQL enum: bcm_criticality_tier_enum
 */
export enum BcmCriticalityTier {
  TIER_0 = 'TIER_0',
  TIER_1 = 'TIER_1',
  TIER_2 = 'TIER_2',
  TIER_3 = 'TIER_3',
}

/**
 * BcmBiaStatus - Status of a Business Impact Analysis
 * Values match PostgreSQL enum: bcm_bias_status_enum
 */
export enum BcmBiaStatus {
  DRAFT = 'DRAFT',
  REVIEWED = 'REVIEWED',
  APPROVED = 'APPROVED',
}

/**
 * BcmPlanType - Type of BCM plan
 * Values match PostgreSQL enum: bcm_plans_plan_type_enum
 */
export enum BcmPlanType {
  BCP = 'BCP',
  DRP = 'DRP',
  IT_CONTINUITY = 'IT_CONTINUITY',
}

/**
 * BcmPlanStatus - Status of a BCM plan
 * Values match PostgreSQL enum: bcm_plans_status_enum
 */
export enum BcmPlanStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  RETIRED = 'RETIRED',
}

/**
 * BcmPlanStepStatus - Status of a BCM plan step
 * Values match PostgreSQL enum: bcm_plan_steps_status_enum
 */
export enum BcmPlanStepStatus {
  PLANNED = 'PLANNED',
  READY = 'READY',
  DEPRECATED = 'DEPRECATED',
}

/**
 * BcmExerciseType - Type of BCM exercise
 * Values match PostgreSQL enum: bcm_exercises_exercise_type_enum
 */
export enum BcmExerciseType {
  TABLETOP = 'TABLETOP',
  FAILOVER = 'FAILOVER',
  RESTORE = 'RESTORE',
  COMMS = 'COMMS',
}

/**
 * BcmExerciseStatus - Status of a BCM exercise
 * Values match PostgreSQL enum: bcm_exercises_status_enum
 */
export enum BcmExerciseStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/**
 * BcmExerciseOutcome - Outcome of a BCM exercise
 * Values match PostgreSQL enum: bcm_exercises_outcome_enum
 */
export enum BcmExerciseOutcome {
  PASS = 'PASS',
  PARTIAL = 'PARTIAL',
  FAIL = 'FAIL',
}

// ============================================================================
// Risk Treatment Action Enums
// ============================================================================

/**
 * TreatmentActionStatus - Status of a risk treatment action
 * Values match PostgreSQL enum: grc_risk_treatment_actions_status_enum
 */
export enum TreatmentActionStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// ============================================================================
// Calendar Enums
// ============================================================================

/**
 * CalendarEventSourceType - Source type for calendar events
 * Used to identify the origin of calendar events
 */
export enum CalendarEventSourceType {
  AUDIT = 'AUDIT',
  CAPA = 'CAPA',
  CAPA_TASK = 'CAPA_TASK',
  BCM_EXERCISE = 'BCM_EXERCISE',
  POLICY_REVIEW = 'POLICY_REVIEW',
  EVIDENCE_REVIEW = 'EVIDENCE_REVIEW',
}

// ============================================================================
// ITSM Enums (ITIL v5 aligned)
// ============================================================================

/**
 * ItsmIncidentState - Lifecycle states for ITSM incidents
 * Values match PostgreSQL enum: itsm_incidents_state_enum
 */
export enum ItsmIncidentState {
  NEW = 'NEW',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

/**
 * ItsmIncidentImpact - Business impact level of an incident
 * Values match PostgreSQL enum: itsm_incidents_impact_enum
 */
export enum ItsmIncidentImpact {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

/**
 * ItsmIncidentUrgency - Time sensitivity of an incident
 * Values match PostgreSQL enum: itsm_incidents_urgency_enum
 */
export enum ItsmIncidentUrgency {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

/**
 * ItsmIncidentPriority - Priority level (derived from impact + urgency)
 * Values match PostgreSQL enum: itsm_incidents_priority_enum
 */
export enum ItsmIncidentPriority {
  P1 = 'P1',
  P2 = 'P2',
  P3 = 'P3',
  P4 = 'P4',
  P5 = 'P5',
}

/**
 * ItsmChangeType - Type of change request (ITIL v5)
 * Values match PostgreSQL enum: itsm_changes_type_enum
 */
export enum ItsmChangeType {
  STANDARD = 'STANDARD',
  NORMAL = 'NORMAL',
  EMERGENCY = 'EMERGENCY',
}

/**
 * ItsmChangeState - Lifecycle states for ITSM changes
 * Values match PostgreSQL enum: itsm_changes_state_enum
 */
export enum ItsmChangeState {
  DRAFT = 'DRAFT',
  ASSESS = 'ASSESS',
  AUTHORIZE = 'AUTHORIZE',
  IMPLEMENT = 'IMPLEMENT',
  REVIEW = 'REVIEW',
  CLOSED = 'CLOSED',
}

/**
 * ItsmChangeRiskLevel - Risk level of a change
 * Values match PostgreSQL enum: itsm_changes_risk_enum
 */
export enum ItsmChangeRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

/**
 * ItsmApprovalStatus - Approval status for changes
 * Values match PostgreSQL enum: itsm_changes_approval_status_enum
 */
export enum ItsmApprovalStatus {
  NOT_REQUESTED = 'NOT_REQUESTED',
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * ItsmServiceCriticality - Criticality level of an ITSM service
 * Values match PostgreSQL enum: itsm_services_criticality_enum
 */
export enum ItsmServiceCriticality {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

/**
 * ItsmServiceStatus - Status of an ITSM service
 * Values match PostgreSQL enum: itsm_services_status_enum
 */
export enum ItsmServiceStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DEPRECATED = 'DEPRECATED',
}
