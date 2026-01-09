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
 */

import { TableSchema, FieldSchema } from '../dto/table-schema.dto';

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
 * Note: Both short names (controls, risks) and full database table names
 * (grc_controls, grc_risks) are supported for convenience.
 */
export const TABLE_SCHEMAS: Record<string, TableSchema> = {
  controls: CONTROLS_SCHEMA,
  grc_controls: CONTROLS_SCHEMA,
  risks: RISKS_SCHEMA,
  grc_risks: RISKS_SCHEMA,
};

/**
 * Set of allowed table names for security validation
 */
export const ALLOWED_TABLES = new Set(Object.keys(TABLE_SCHEMAS));

/**
 * Get schema for a table by name
 * @param tableName - The table name to look up
 * @returns TableSchema or null if not found
 */
export function getTableSchema(tableName: string): TableSchema | null {
  return TABLE_SCHEMAS[tableName] || null;
}

/**
 * Check if a table is allowed for schema access
 * @param tableName - The table name to check
 * @returns true if the table is in the allowlist
 */
export function isTableAllowed(tableName: string): boolean {
  return ALLOWED_TABLES.has(tableName);
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
