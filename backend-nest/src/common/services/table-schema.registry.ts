/**
 * Table Schema Registry
 *
 * Central registry for table schemas used by the Universal Views feature.
 * Each table that supports dynamic columns must be registered here.
 *
 * To add a new table:
 * 1. Define the schema with all fields
 * 2. Register it in TABLE_SCHEMAS
 * 3. Add to ALLOWED_TABLES set
 *
 * Alias Resolution:
 * The registry supports table name aliases (e.g., grc_controls -> controls).
 * All lookups are performed using canonical names after normalization.
 * See resolveCanonicalTableName() for supported aliases.
 */

import { TableSchema, FieldSchema } from '../dto/table-schema.dto';

/**
 * Table name alias map
 * Maps alias names to their canonical names
 */
const TABLE_ALIASES: Record<string, string> = {
  grc_controls: 'controls',
  grc_risks: 'risks',
};

/**
 * Normalize a table name by trimming whitespace, converting to lowercase,
 * and replacing hyphens with underscores.
 *
 * @param name - The raw table name input
 * @returns Normalized table name
 *
 * @example
 * normalizeTableName('  GRC-Controls  ') // returns 'grc_controls'
 * normalizeTableName('RISKS') // returns 'risks'
 */
export function normalizeTableName(name: string): string {
  return name.trim().toLowerCase().replace(/-/g, '_');
}

/**
 * Resolve a table name to its canonical form.
 * First normalizes the input, then resolves any aliases.
 *
 * @param name - The raw table name input
 * @returns Canonical table name
 *
 * @example
 * resolveCanonicalTableName('grc_controls') // returns 'controls'
 * resolveCanonicalTableName('GRC-RISKS') // returns 'risks'
 * resolveCanonicalTableName('controls') // returns 'controls'
 * resolveCanonicalTableName(' CONTROLS ') // returns 'controls'
 */
export function resolveCanonicalTableName(name: string): string {
  const normalized = normalizeTableName(name);
  return TABLE_ALIASES[normalized] || normalized;
}

/**
 * Get all supported table aliases
 * @returns Record of alias -> canonical name mappings
 */
export function getTableAliases(): Record<string, string> {
  return { ...TABLE_ALIASES };
}

/**
 * Check if a table name is an alias (not canonical)
 * @param name - The table name to check
 * @returns true if the name is an alias
 */
export function isTableAlias(name: string): boolean {
  const normalized = normalizeTableName(name);
  return normalized in TABLE_ALIASES;
}

/**
 * Controls table schema
 */
const CONTROLS_SCHEMA: TableSchema = {
  tableName: 'controls',
  displayName: 'Controls',
  fields: [
    {
      name: 'code',
      label: 'Code',
      dataType: 'string',
      searchable: true,
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      name: 'name',
      label: 'Name',
      dataType: 'string',
      searchable: true,
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      name: 'description',
      label: 'Description',
      dataType: 'string',
      searchable: true,
      filterable: false,
      sortable: false,
      defaultVisible: false,
    },
    {
      name: 'type',
      label: 'Type',
      dataType: 'enum',
      enumValues: ['preventive', 'detective', 'corrective'],
      searchable: false,
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      name: 'implementationType',
      label: 'Implementation Type',
      dataType: 'enum',
      enumValues: ['manual', 'automated', 'it_dependent'],
      searchable: false,
      filterable: true,
      sortable: true,
      defaultVisible: false,
    },
    {
      name: 'status',
      label: 'Status',
      dataType: 'enum',
      enumValues: [
        'draft',
        'in_design',
        'implemented',
        'inoperative',
        'retired',
      ],
      searchable: false,
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      name: 'frequency',
      label: 'Frequency',
      dataType: 'enum',
      enumValues: [
        'continuous',
        'daily',
        'weekly',
        'monthly',
        'quarterly',
        'annual',
      ],
      searchable: false,
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      name: 'ownerUserId',
      label: 'Owner',
      dataType: 'relation',
      relationTable: 'users',
      relationLabelField: 'email',
      searchable: false,
      filterable: true,
      sortable: false,
      defaultVisible: false,
    },
    {
      name: 'effectiveDate',
      label: 'Effective Date',
      dataType: 'date',
      searchable: false,
      filterable: true,
      sortable: true,
      defaultVisible: false,
    },
    {
      name: 'lastTestedDate',
      label: 'Last Tested',
      dataType: 'date',
      searchable: false,
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      name: 'nextTestDate',
      label: 'Next Test',
      dataType: 'date',
      searchable: false,
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      name: 'lastTestResult',
      label: 'Last Test Result',
      dataType: 'enum',
      enumValues: ['PASS', 'FAIL', 'INCONCLUSIVE', 'NOT_APPLICABLE'],
      searchable: false,
      filterable: true,
      sortable: true,
      defaultVisible: false,
    },
    {
      name: 'createdAt',
      label: 'Created At',
      dataType: 'date',
      searchable: false,
      filterable: true,
      sortable: true,
      defaultVisible: false,
    },
    {
      name: 'updatedAt',
      label: 'Updated At',
      dataType: 'date',
      searchable: false,
      filterable: true,
      sortable: true,
      defaultVisible: false,
    },
  ],
};

/**
 * Risks table schema
 */
const RISKS_SCHEMA: TableSchema = {
  tableName: 'risks',
  displayName: 'Risks',
  fields: [
    {
      name: 'title',
      label: 'Title',
      dataType: 'string',
      searchable: true,
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      name: 'description',
      label: 'Description',
      dataType: 'string',
      searchable: true,
      filterable: false,
      sortable: false,
      defaultVisible: false,
    },
    {
      name: 'category',
      label: 'Category',
      dataType: 'string',
      searchable: true,
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      name: 'severity',
      label: 'Severity',
      dataType: 'enum',
      enumValues: ['low', 'medium', 'high', 'critical'],
      searchable: false,
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      name: 'likelihood',
      label: 'Likelihood',
      dataType: 'enum',
      enumValues: ['rare', 'unlikely', 'possible', 'likely', 'almost_certain'],
      searchable: false,
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      name: 'impact',
      label: 'Impact',
      dataType: 'enum',
      enumValues: ['low', 'medium', 'high', 'critical'],
      searchable: false,
      filterable: true,
      sortable: true,
      defaultVisible: false,
    },
    {
      name: 'score',
      label: 'Score',
      dataType: 'number',
      searchable: false,
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      name: 'status',
      label: 'Status',
      dataType: 'enum',
      enumValues: [
        'draft',
        'identified',
        'assessed',
        'mitigating',
        'accepted',
        'closed',
      ],
      searchable: false,
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      name: 'ownerUserId',
      label: 'Owner',
      dataType: 'relation',
      relationTable: 'users',
      relationLabelField: 'email',
      searchable: false,
      filterable: true,
      sortable: false,
      defaultVisible: false,
    },
    {
      name: 'dueDate',
      label: 'Due Date',
      dataType: 'date',
      searchable: false,
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      name: 'mitigationPlan',
      label: 'Mitigation Plan',
      dataType: 'string',
      searchable: true,
      filterable: false,
      sortable: false,
      defaultVisible: false,
    },
    {
      name: 'createdAt',
      label: 'Created At',
      dataType: 'date',
      searchable: false,
      filterable: true,
      sortable: true,
      defaultVisible: false,
    },
    {
      name: 'updatedAt',
      label: 'Updated At',
      dataType: 'date',
      searchable: false,
      filterable: true,
      sortable: true,
      defaultVisible: false,
    },
  ],
};

/**
 * Central registry of all table schemas
 *
 * Note: Only canonical table names are stored in this registry.
 * Aliases (e.g., grc_controls, grc_risks) are resolved to canonical names
 * via resolveCanonicalTableName() before lookup.
 */
export const TABLE_SCHEMAS: Record<string, TableSchema> = {
  controls: CONTROLS_SCHEMA,
  risks: RISKS_SCHEMA,
};

/**
 * Set of allowed table names for security validation
 * Includes both canonical names and known aliases
 */
export const ALLOWED_TABLES = new Set([
  ...Object.keys(TABLE_SCHEMAS),
  ...Object.keys(TABLE_ALIASES),
]);

/**
 * Get schema for a table by name
 * Automatically resolves aliases to canonical names.
 *
 * @param tableName - The table name to look up (can be alias or canonical)
 * @returns TableSchema or null if not found
 */
export function getTableSchema(tableName: string): TableSchema | null {
  const canonical = resolveCanonicalTableName(tableName);
  return TABLE_SCHEMAS[canonical] || null;
}

/**
 * Check if a table is allowed for schema access
 * Automatically normalizes and resolves aliases.
 *
 * @param tableName - The table name to check (can be alias or canonical)
 * @returns true if the table resolves to a known canonical name
 */
export function isTableAllowed(tableName: string): boolean {
  const canonical = resolveCanonicalTableName(tableName);
  return canonical in TABLE_SCHEMAS;
}

/**
 * Get filterable fields for a table
 * @param tableName - The table name
 * @returns Array of filterable field schemas
 */
export function getFilterableFields(tableName: string): FieldSchema[] {
  const schema = getTableSchema(tableName);
  if (!schema) return [];
  return schema.fields.filter((f) => f.filterable);
}

/**
 * Get sortable fields for a table
 * @param tableName - The table name
 * @returns Array of sortable field names
 */
export function getSortableFields(tableName: string): string[] {
  const schema = getTableSchema(tableName);
  if (!schema) return [];
  return schema.fields.filter((f) => f.sortable).map((f) => f.name);
}

/**
 * Get searchable fields for a table
 * @param tableName - The table name
 * @returns Array of searchable field names
 */
export function getSearchableFields(tableName: string): string[] {
  const schema = getTableSchema(tableName);
  if (!schema) return [];
  return schema.fields.filter((f) => f.searchable).map((f) => f.name);
}

/**
 * Get default visible columns for a table
 * @param tableName - The table name
 * @returns Array of default visible field names
 */
export function getDefaultVisibleColumns(tableName: string): string[] {
  const schema = getTableSchema(tableName);
  if (!schema) return [];
  return schema.fields.filter((f) => f.defaultVisible).map((f) => f.name);
}

/**
 * Validate that a field is filterable for a table
 * @param tableName - The table name
 * @param fieldName - The field name to check
 * @returns true if the field is filterable
 */
export function isFieldFilterable(
  tableName: string,
  fieldName: string,
): boolean {
  const schema = getTableSchema(tableName);
  if (!schema) return false;
  const field = schema.fields.find((f) => f.name === fieldName);
  return field?.filterable ?? false;
}

/**
 * Validate that a field is sortable for a table
 * @param tableName - The table name
 * @param fieldName - The field name to check
 * @returns true if the field is sortable
 */
export function isFieldSortable(tableName: string, fieldName: string): boolean {
  const schema = getTableSchema(tableName);
  if (!schema) return false;
  const field = schema.fields.find((f) => f.name === fieldName);
  return field?.sortable ?? false;
}

/**
 * Get field schema by name
 * @param tableName - The table name
 * @param fieldName - The field name
 * @returns FieldSchema or null if not found
 */
export function getFieldSchema(
  tableName: string,
  fieldName: string,
): FieldSchema | null {
  const schema = getTableSchema(tableName);
  if (!schema) return null;
  return schema.fields.find((f) => f.name === fieldName) || null;
}
