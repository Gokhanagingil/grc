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
 * Registry of all entity allowlists
 */
const ALLOWLIST_REGISTRY: Record<string, EntityAllowlist> = {
  control: CONTROL_ALLOWLIST,
  // Add more entities here as they are onboarded
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
