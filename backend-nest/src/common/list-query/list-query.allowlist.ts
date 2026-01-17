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
  { column: 'name' },
  { column: 'description' },
];

/**
 * Registry of all entity allowlists
 */
const ALLOWLIST_REGISTRY: Record<string, EntityAllowlist> = {
  control: CONTROL_ALLOWLIST,
  issue: ISSUE_ALLOWLIST,
  capa: CAPA_ALLOWLIST,
  evidence: EVIDENCE_ALLOWLIST,
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
