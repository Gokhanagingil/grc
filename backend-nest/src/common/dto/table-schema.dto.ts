/**
 * Table Schema DTOs
 *
 * Defines the schema metadata for list rendering and column configuration.
 * Used by the Universal Views feature to expose table structure to the frontend.
 */

/**
 * Data types supported by the schema system
 */
export type SchemaDataType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'enum'
  | 'uuid'
  | 'relation';

/**
 * Field schema definition for a single column
 */
export interface FieldSchema {
  name: string;
  label: string;
  dataType: SchemaDataType;
  enumValues?: string[];
  searchable: boolean;
  filterable: boolean;
  sortable: boolean;
  defaultVisible: boolean;
  width?: number;
  relationTable?: string;
  relationLabelField?: string;
}

/**
 * Complete table schema for list rendering
 */
export interface TableSchema {
  tableName: string;
  displayName: string;
  fields: FieldSchema[];
}

/**
 * Filter operation types by data type
 */
export type StringFilterOp =
  | 'eq'
  | 'ilike'
  | 'startsWith'
  | 'endsWith'
  | 'in'
  | 'isNull'
  | 'isNotNull';
export type NumberFilterOp = 'eq' | 'gte' | 'lte' | 'between' | 'in';
export type DateFilterOp = 'between' | 'gte' | 'lte';
export type EnumFilterOp = 'eq' | 'in';
export type BooleanFilterOp = 'eq';

/**
 * Filter value structure for the filter DSL
 */
export interface ColumnFilter {
  op: string;
  value: unknown;
  valueTo?: unknown; // For 'between' operations
}

/**
 * User view preference structure
 */
export interface ViewPreference {
  visibleColumns: string[];
  columnOrder: string[];
  columnWidths?: Record<string, number>;
  sort?: {
    field: string;
    direction: 'ASC' | 'DESC';
  };
  filters?: Record<string, ColumnFilter>;
  pageSize?: number;
}

/**
 * Response format for GET /platform/views/:tableName
 */
export interface ViewPreferenceResponse {
  tableName: string;
  userId: string;
  tenantId: string;
  preference: ViewPreference;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Request format for PUT /platform/views/:tableName
 */
export interface SaveViewPreferenceDto {
  visibleColumns?: string[];
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
  sort?: {
    field: string;
    direction: 'ASC' | 'DESC';
  };
  filters?: Record<string, ColumnFilter>;
  pageSize?: number;
}
