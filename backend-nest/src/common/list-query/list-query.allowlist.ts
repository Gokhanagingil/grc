/**
 * List Query Allowlists
 *
 * Entity-specific allowlist configurations for the advanced filter system.
 * Each entity defines its filterable fields, types, and allowed operators.
 */

import { EntityAllowlist, FieldDefinition } from './list-query.types';

/**
 * Control entity field definitions
 */
const CONTROL_FIELDS: FieldDefinition[] = [
  { name: 'name', type: 'string' },
  { name: 'code', type: 'string' },
  { name: 'description', type: 'string' },
  {
    name: 'status',
    type: 'enum',
    enumValues: ['draft', 'in_design', 'implemented', 'inoperative', 'retired'],
    caseInsensitive: true,
  },
  {
    name: 'type',
    type: 'enum',
    enumValues: ['preventive', 'detective', 'corrective'],
    caseInsensitive: true,
  },
  {
    name: 'implementationType',
    column: 'implementation_type',
    type: 'enum',
    enumValues: ['manual', 'automated', 'it_dependent'],
    caseInsensitive: true,
  },
  {
    name: 'frequency',
    type: 'enum',
    enumValues: [
      'continuous',
      'daily',
      'weekly',
      'monthly',
      'quarterly',
      'annual',
    ],
    caseInsensitive: true,
  },
  { name: 'createdAt', column: 'created_at', type: 'date' },
  { name: 'updatedAt', column: 'updated_at', type: 'date' },
  { name: 'effectiveDate', column: 'effective_date', type: 'date' },
  { name: 'lastTestedDate', column: 'last_tested_date', type: 'date' },
  { name: 'nextTestDate', column: 'next_test_date', type: 'date' },
  { name: 'ownerUserId', column: 'owner_user_id', type: 'uuid' },
  {
    name: 'lastTestResult',
    column: 'last_test_result',
    type: 'enum',
    enumValues: ['PASS', 'FAIL', 'INCONCLUSIVE', 'NOT_APPLICABLE'],
    caseInsensitive: true,
  },
];

/**
 * Control entity allowlist configuration
 */
export const CONTROL_ALLOWLIST: EntityAllowlist = {
  entityName: 'Control',
  fields: CONTROL_FIELDS,
  dotWalkPaths: [
    // Add allowed dot-walk paths here when needed
    // Example: 'owner.email', 'owner.firstName'
  ],
};

/**
 * Control searchable columns for quick search
 */
export const CONTROL_SEARCHABLE_COLUMNS = [
  { column: 'name' },
  { column: 'code' },
  { column: 'description' },
];

/**
 * Issue entity field definitions
 */
const ISSUE_FIELDS: FieldDefinition[] = [
  { name: 'code', type: 'string' },
  { name: 'title', type: 'string' },
  { name: 'description', type: 'string' },
  {
    name: 'type',
    type: 'enum',
    enumValues: [
      'internal_audit',
      'external_audit',
      'incident',
      'self_assessment',
      'other',
    ],
    caseInsensitive: true,
  },
  {
    name: 'status',
    type: 'enum',
    enumValues: ['open', 'in_progress', 'resolved', 'closed', 'rejected'],
    caseInsensitive: true,
  },
  {
    name: 'severity',
    type: 'enum',
    enumValues: ['low', 'medium', 'high', 'critical'],
    caseInsensitive: true,
  },
  {
    name: 'source',
    type: 'enum',
    enumValues: ['manual', 'test_result', 'audit', 'incident', 'external'],
    caseInsensitive: true,
  },
  { name: 'createdAt', column: 'created_at', type: 'date' },
  { name: 'updatedAt', column: 'updated_at', type: 'date' },
  { name: 'discoveredDate', column: 'discovered_date', type: 'date' },
  { name: 'dueDate', column: 'due_date', type: 'date' },
  { name: 'resolvedDate', column: 'resolved_date', type: 'date' },
  { name: 'controlId', column: 'control_id', type: 'uuid' },
  { name: 'auditId', column: 'audit_id', type: 'uuid' },
  { name: 'testResultId', column: 'test_result_id', type: 'uuid' },
  { name: 'riskId', column: 'risk_id', type: 'uuid' },
  { name: 'ownerUserId', column: 'owner_user_id', type: 'uuid' },
];

/**
 * Issue entity allowlist configuration
 */
export const ISSUE_ALLOWLIST: EntityAllowlist = {
  entityName: 'Issue',
  fields: ISSUE_FIELDS,
  dotWalkPaths: ['control.name', 'control.code'],
};

/**
 * Issue searchable columns for quick search
 */
export const ISSUE_SEARCHABLE_COLUMNS = [
  { column: 'code' },
  { column: 'title' },
  { column: 'description' },
];

/**
 * CAPA entity field definitions
 */
const CAPA_FIELDS: FieldDefinition[] = [
  { name: 'title', type: 'string' },
  { name: 'description', type: 'string' },
  { name: 'rootCauseAnalysis', column: 'root_cause_analysis', type: 'string' },
  {
    name: 'type',
    type: 'enum',
    enumValues: ['corrective', 'preventive', 'both'],
    caseInsensitive: true,
  },
  {
    name: 'status',
    type: 'enum',
    enumValues: [
      'planned',
      'in_progress',
      'implemented',
      'verified',
      'closed',
      'cancelled',
    ],
    caseInsensitive: true,
  },
  {
    name: 'priority',
    type: 'enum',
    enumValues: ['low', 'medium', 'high', 'critical'],
    caseInsensitive: true,
  },
  { name: 'createdAt', column: 'created_at', type: 'date' },
  { name: 'updatedAt', column: 'updated_at', type: 'date' },
  { name: 'dueDate', column: 'due_date', type: 'date' },
  { name: 'completedDate', column: 'completed_date', type: 'date' },
  { name: 'verifiedAt', column: 'verified_at', type: 'date' },
  { name: 'closedAt', column: 'closed_at', type: 'date' },
  { name: 'issueId', column: 'issue_id', type: 'uuid' },
  { name: 'ownerUserId', column: 'owner_user_id', type: 'uuid' },
];

/**
 * CAPA entity allowlist configuration
 */
export const CAPA_ALLOWLIST: EntityAllowlist = {
  entityName: 'CAPA',
  fields: CAPA_FIELDS,
  dotWalkPaths: ['issue.title', 'issue.status'],
};

/**
 * CAPA searchable columns for quick search
 */
export const CAPA_SEARCHABLE_COLUMNS = [
  { column: 'title' },
  { column: 'description' },
  { column: 'root_cause_analysis' },
];

/**
 * Evidence entity field definitions
 */
const EVIDENCE_FIELDS: FieldDefinition[] = [
  { name: 'code', type: 'string' },
  { name: 'name', type: 'string' },
  { name: 'description', type: 'string' },
  { name: 'location', type: 'string' },
  {
    name: 'type',
    type: 'enum',
    enumValues: ['BASELINE', 'TEST', 'PERIODIC'],
    caseInsensitive: true,
  },
  {
    name: 'status',
    type: 'enum',
    enumValues: ['draft', 'submitted', 'approved', 'rejected'],
    caseInsensitive: true,
  },
  { name: 'createdAt', column: 'created_at', type: 'date' },
  { name: 'updatedAt', column: 'updated_at', type: 'date' },
  { name: 'collectedDate', column: 'collected_date', type: 'date' },
  { name: 'expiresAt', column: 'expires_at', type: 'date' },
  { name: 'ownerUserId', column: 'owner_user_id', type: 'uuid' },
];

/**
 * Evidence entity allowlist configuration
 */
export const EVIDENCE_ALLOWLIST: EntityAllowlist = {
  entityName: 'Evidence',
  fields: EVIDENCE_FIELDS,
  dotWalkPaths: [],
};

/**
 * Evidence searchable columns for quick search
 */
export const EVIDENCE_SEARCHABLE_COLUMNS = [
  { column: 'code' },
  { column: 'name' },
  { column: 'description' },
];

/**
 * BCM Service entity field definitions
 */
const BCM_SERVICE_FIELDS: FieldDefinition[] = [
  { name: 'name', type: 'string' },
  { name: 'description', type: 'string' },
  {
    name: 'status',
    type: 'enum',
    enumValues: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
    caseInsensitive: true,
  },
  {
    name: 'criticalityTier',
    column: 'criticality_tier',
    type: 'enum',
    enumValues: ['TIER_0', 'TIER_1', 'TIER_2', 'TIER_3'],
    caseInsensitive: true,
  },
  { name: 'createdAt', column: 'created_at', type: 'date' },
  { name: 'updatedAt', column: 'updated_at', type: 'date' },
  {
    name: 'businessOwnerUserId',
    column: 'business_owner_user_id',
    type: 'uuid',
  },
  { name: 'itOwnerUserId', column: 'it_owner_user_id', type: 'uuid' },
];

/**
 * BCM Service entity allowlist configuration
 */
export const BCM_SERVICE_ALLOWLIST: EntityAllowlist = {
  entityName: 'BcmService',
  fields: BCM_SERVICE_FIELDS,
  dotWalkPaths: [],
};

/**
 * BCM Service searchable columns for quick search
 */
export const BCM_SERVICE_SEARCHABLE_COLUMNS = [
  { column: 'name' },
  { column: 'description' },
];

/**
 * BCM BIA entity field definitions
 */
const BCM_BIA_FIELDS: FieldDefinition[] = [
  { name: 'assumptions', type: 'string' },
  { name: 'dependencies', type: 'string' },
  { name: 'notes', type: 'string' },
  {
    name: 'status',
    type: 'enum',
    enumValues: ['DRAFT', 'REVIEWED', 'APPROVED'],
    caseInsensitive: true,
  },
  {
    name: 'criticalityTier',
    column: 'criticality_tier',
    type: 'enum',
    enumValues: ['TIER_0', 'TIER_1', 'TIER_2', 'TIER_3'],
    caseInsensitive: true,
  },
  { name: 'rtoMinutes', column: 'rto_minutes', type: 'number' },
  { name: 'rpoMinutes', column: 'rpo_minutes', type: 'number' },
  { name: 'mtpdMinutes', column: 'mtpd_minutes', type: 'number' },
  {
    name: 'overallImpactScore',
    column: 'overall_impact_score',
    type: 'number',
  },
  { name: 'createdAt', column: 'created_at', type: 'date' },
  { name: 'updatedAt', column: 'updated_at', type: 'date' },
  { name: 'serviceId', column: 'service_id', type: 'uuid' },
];

/**
 * BCM BIA entity allowlist configuration
 */
export const BCM_BIA_ALLOWLIST: EntityAllowlist = {
  entityName: 'BcmBia',
  fields: BCM_BIA_FIELDS,
  dotWalkPaths: ['service.name'],
};

/**
 * BCM BIA searchable columns for quick search
 */
export const BCM_BIA_SEARCHABLE_COLUMNS = [
  { column: 'assumptions' },
  { column: 'dependencies' },
  { column: 'notes' },
];

/**
 * BCM Plan entity field definitions
 */
const BCM_PLAN_FIELDS: FieldDefinition[] = [
  { name: 'summary', type: 'string' },
  { name: 'triggers', type: 'string' },
  { name: 'recoverySteps', column: 'recovery_steps', type: 'string' },
  {
    name: 'planType',
    column: 'plan_type',
    type: 'enum',
    enumValues: ['BCP', 'DRP', 'IT_CONTINUITY'],
    caseInsensitive: true,
  },
  {
    name: 'status',
    type: 'enum',
    enumValues: ['DRAFT', 'APPROVED', 'ACTIVE', 'RETIRED'],
    caseInsensitive: true,
  },
  { name: 'createdAt', column: 'created_at', type: 'date' },
  { name: 'updatedAt', column: 'updated_at', type: 'date' },
  { name: 'approvedAt', column: 'approved_at', type: 'date' },
  { name: 'serviceId', column: 'service_id', type: 'uuid' },
  { name: 'ownerUserId', column: 'owner_user_id', type: 'uuid' },
  { name: 'approverUserId', column: 'approver_user_id', type: 'uuid' },
];

/**
 * BCM Plan entity allowlist configuration
 */
export const BCM_PLAN_ALLOWLIST: EntityAllowlist = {
  entityName: 'BcmPlan',
  fields: BCM_PLAN_FIELDS,
  dotWalkPaths: ['service.name'],
};

/**
 * BCM Plan searchable columns for quick search
 */
export const BCM_PLAN_SEARCHABLE_COLUMNS = [
  { column: 'summary' },
  { column: 'triggers' },
];

/**
 * BCM Exercise entity field definitions
 */
const BCM_EXERCISE_FIELDS: FieldDefinition[] = [
  { name: 'summary', type: 'string' },
  { name: 'lessonsLearned', column: 'lessons_learned', type: 'string' },
  {
    name: 'exerciseType',
    column: 'exercise_type',
    type: 'enum',
    enumValues: ['TABLETOP', 'FAILOVER', 'RESTORE', 'COMMS'],
    caseInsensitive: true,
  },
  {
    name: 'status',
    type: 'enum',
    enumValues: ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    caseInsensitive: true,
  },
  {
    name: 'outcome',
    type: 'enum',
    enumValues: ['PASS', 'PARTIAL', 'FAIL'],
    caseInsensitive: true,
  },
  { name: 'scheduledAt', column: 'scheduled_at', type: 'date' },
  { name: 'startedAt', column: 'started_at', type: 'date' },
  { name: 'completedAt', column: 'completed_at', type: 'date' },
  { name: 'createdAt', column: 'created_at', type: 'date' },
  { name: 'updatedAt', column: 'updated_at', type: 'date' },
  { name: 'serviceId', column: 'service_id', type: 'uuid' },
  { name: 'planId', column: 'plan_id', type: 'uuid' },
];

/**
 * BCM Exercise entity allowlist configuration
 */
export const BCM_EXERCISE_ALLOWLIST: EntityAllowlist = {
  entityName: 'BcmExercise',
  fields: BCM_EXERCISE_FIELDS,
  dotWalkPaths: ['service.name', 'plan.summary'],
};

/**
 * BCM Exercise searchable columns for quick search
 */
export const BCM_EXERCISE_SEARCHABLE_COLUMNS = [
  { column: 'summary' },
  { column: 'lessons_learned' },
];

/**
 * Registry of all entity allowlists
 * Supports both singular and plural entity names for API flexibility
 */
const ALLOWLIST_REGISTRY: Record<string, EntityAllowlist> = {
  // Singular names (canonical)
  control: CONTROL_ALLOWLIST,
  issue: ISSUE_ALLOWLIST,
  capa: CAPA_ALLOWLIST,
  evidence: EVIDENCE_ALLOWLIST,
  bcmservice: BCM_SERVICE_ALLOWLIST,
  bcmbia: BCM_BIA_ALLOWLIST,
  bcmplan: BCM_PLAN_ALLOWLIST,
  bcmexercise: BCM_EXERCISE_ALLOWLIST,
  // Plural aliases (for API convenience)
  controls: CONTROL_ALLOWLIST,
  issues: ISSUE_ALLOWLIST,
  capas: CAPA_ALLOWLIST,
  bcmservices: BCM_SERVICE_ALLOWLIST,
  bcmbias: BCM_BIA_ALLOWLIST,
  bcmplans: BCM_PLAN_ALLOWLIST,
  bcmexercises: BCM_EXERCISE_ALLOWLIST,
};

/**
 * Get allowlist for an entity
 *
 * @param entityName - Entity name (case-insensitive)
 * @returns Entity allowlist or undefined
 */
export function getEntityAllowlist(
  entityName: string,
): EntityAllowlist | undefined {
  return ALLOWLIST_REGISTRY[entityName.toLowerCase()];
}

/**
 * Check if an entity has an allowlist configured
 */
export function hasEntityAllowlist(entityName: string): boolean {
  return entityName.toLowerCase() in ALLOWLIST_REGISTRY;
}

/**
 * Get all registered entity names
 */
export function getRegisteredEntities(): string[] {
  return Object.keys(ALLOWLIST_REGISTRY);
}

/**
 * Create a custom allowlist configuration
 * Useful for entities that need dynamic configuration
 */
export function createAllowlist(
  entityName: string,
  fields: FieldDefinition[],
  dotWalkPaths?: string[],
): EntityAllowlist {
  return {
    entityName,
    fields,
    dotWalkPaths,
  };
}
