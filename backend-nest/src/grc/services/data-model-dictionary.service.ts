import { Injectable } from '@nestjs/common';
import { DataSource, EntityMetadata } from 'typeorm';

/**
 * Field type enumeration for dictionary
 */
export enum DictionaryFieldType {
  STRING = 'string',
  TEXT = 'text',
  INTEGER = 'integer',
  DECIMAL = 'decimal',
  BOOLEAN = 'boolean',
  DATE = 'date',
  DATETIME = 'datetime',
  UUID = 'uuid',
  ENUM = 'enum',
  JSON = 'json',
  REFERENCE = 'reference',
  UNKNOWN = 'unknown',
}

/**
 * Relationship type enumeration
 */
export enum RelationshipType {
  ONE_TO_ONE = 'one-to-one',
  ONE_TO_MANY = 'one-to-many',
  MANY_TO_ONE = 'many-to-one',
  MANY_TO_MANY = 'many-to-many',
}

/**
 * Dictionary field metadata
 */
export interface DictionaryField {
  name: string;
  columnName: string;
  type: DictionaryFieldType;
  label: string;
  description: string | null;
  isRequired: boolean;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isGenerated: boolean;
  isAuditField: boolean;
  isTenantScoped: boolean;
  defaultValue: unknown | null;
  enumValues: string[] | null;
  referenceTarget: string | null;
  maxLength: number | null;
}

/**
 * Dictionary relationship metadata
 */
export interface DictionaryRelationship {
  name: string;
  type: RelationshipType;
  sourceTable: string;
  sourceField: string;
  targetTable: string;
  targetField: string;
  isNullable: boolean;
  isCascade: boolean;
  inverseRelationship: string | null;
}

/**
 * Dictionary table metadata
 */
export interface DictionaryTable {
  name: string;
  tableName: string;
  label: string;
  description: string | null;
  isTenantScoped: boolean;
  hasSoftDelete: boolean;
  hasAuditFields: boolean;
  fields: DictionaryField[];
  relationships: DictionaryRelationship[];
  primaryKeyField: string;
}

/**
 * Dot-walking path segment
 */
export interface DotWalkSegment {
  field: string;
  targetTable: string;
  relationshipType: RelationshipType;
}

/**
 * Dot-walking path result
 */
export interface DotWalkPath {
  path: string;
  segments: DotWalkSegment[];
  reachableTables: string[];
}

/**
 * Data Model Dictionary Service
 *
 * Provides metadata about the platform's data model derived from TypeORM entities.
 * This service is the single source of truth for the Admin Studio's data model explorer.
 *
 * Key features:
 * - Introspects TypeORM entity metadata
 * - Provides table, field, and relationship information
 * - Supports dot-walking path preview
 * - Metadata-driven (not database introspection)
 */
@Injectable()
export class DataModelDictionaryService {
  private tableCache: Map<string, DictionaryTable> = new Map();
  private initialized = false;

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Initialize the dictionary cache from TypeORM metadata
   */
  private initialize(): void {
    if (this.initialized) return;

    const entityMetadatas = this.dataSource.entityMetadatas;

    for (const metadata of entityMetadatas) {
      const table = this.buildTableMetadata(metadata);
      this.tableCache.set(table.name, table);
    }

    this.initialized = true;
  }

  /**
   * Build table metadata from TypeORM entity metadata
   */
  private buildTableMetadata(metadata: EntityMetadata): DictionaryTable {
    const fields = this.buildFieldsMetadata(metadata);
    const relationships = this.buildRelationshipsMetadata(metadata);

    const isTenantScoped = fields.some((f) => f.name === 'tenantId');
    const hasSoftDelete = fields.some((f) => f.name === 'isDeleted');
    const hasAuditFields = fields.some(
      (f) => f.name === 'createdAt' || f.name === 'updatedAt',
    );

    const primaryKeyField =
      metadata.primaryColumns[0]?.propertyName || 'id';

    return {
      name: metadata.name,
      tableName: metadata.tableName,
      label: this.formatLabel(metadata.name),
      description: this.getTableDescription(metadata.name),
      isTenantScoped,
      hasSoftDelete,
      hasAuditFields,
      fields,
      relationships,
      primaryKeyField,
    };
  }

  /**
   * Build fields metadata from TypeORM columns
   */
  private buildFieldsMetadata(metadata: EntityMetadata): DictionaryField[] {
    const fields: DictionaryField[] = [];

    for (const column of metadata.columns) {
      const field: DictionaryField = {
        name: column.propertyName,
        columnName: column.databaseName,
        type: this.mapColumnType(column.type as string, column),
        label: this.formatLabel(column.propertyName),
        description: null,
        isRequired: !column.isNullable,
        isNullable: column.isNullable,
        isPrimaryKey: column.isPrimary,
        isGenerated: column.isGenerated,
        isAuditField: this.isAuditField(column.propertyName),
        isTenantScoped: column.propertyName === 'tenantId',
        defaultValue: column.default ?? null,
        enumValues: column.enum ? Object.values(column.enum) as string[] : null,
        referenceTarget: null,
        maxLength: column.length ? parseInt(column.length, 10) : null,
      };

      fields.push(field);
    }

    return fields;
  }

  /**
   * Build relationships metadata from TypeORM relations
   */
  private buildRelationshipsMetadata(
    metadata: EntityMetadata,
  ): DictionaryRelationship[] {
    const relationships: DictionaryRelationship[] = [];

    for (const relation of metadata.relations) {
      const relationType = this.mapRelationType(relation.relationType);
      const targetMetadata = relation.inverseEntityMetadata;

      const relationship: DictionaryRelationship = {
        name: relation.propertyName,
        type: relationType,
        sourceTable: metadata.name,
        sourceField: relation.propertyName,
        targetTable: targetMetadata.name,
        targetField: relation.inverseSidePropertyPath || 'id',
        isNullable: relation.isNullable,
        isCascade: Array.isArray(relation.cascadeOptions)
          ? relation.cascadeOptions.length > 0
          : !!relation.cascadeOptions,
        inverseRelationship: relation.inverseSidePropertyPath || null,
      };

      relationships.push(relationship);
    }

    return relationships;
  }

  /**
   * Map TypeORM column type to dictionary field type
   */
  private mapColumnType(
    type: string,
    column: { enum?: object },
  ): DictionaryFieldType {
    if (column.enum) return DictionaryFieldType.ENUM;

    const typeMap: Record<string, DictionaryFieldType> = {
      varchar: DictionaryFieldType.STRING,
      text: DictionaryFieldType.TEXT,
      int: DictionaryFieldType.INTEGER,
      integer: DictionaryFieldType.INTEGER,
      decimal: DictionaryFieldType.DECIMAL,
      numeric: DictionaryFieldType.DECIMAL,
      boolean: DictionaryFieldType.BOOLEAN,
      bool: DictionaryFieldType.BOOLEAN,
      date: DictionaryFieldType.DATE,
      timestamp: DictionaryFieldType.DATETIME,
      timestamptz: DictionaryFieldType.DATETIME,
      uuid: DictionaryFieldType.UUID,
      jsonb: DictionaryFieldType.JSON,
      json: DictionaryFieldType.JSON,
    };

    const normalizedType = String(type).toLowerCase();
    return typeMap[normalizedType] || DictionaryFieldType.UNKNOWN;
  }

  /**
   * Map TypeORM relation type to dictionary relationship type
   */
  private mapRelationType(type: string): RelationshipType {
    const typeMap: Record<string, RelationshipType> = {
      'one-to-one': RelationshipType.ONE_TO_ONE,
      'one-to-many': RelationshipType.ONE_TO_MANY,
      'many-to-one': RelationshipType.MANY_TO_ONE,
      'many-to-many': RelationshipType.MANY_TO_MANY,
    };

    return typeMap[type] || RelationshipType.MANY_TO_ONE;
  }

  /**
   * Check if a field is an audit field
   */
  private isAuditField(fieldName: string): boolean {
    const auditFields = [
      'createdAt',
      'updatedAt',
      'createdBy',
      'updatedBy',
      'isDeleted',
      'deletedAt',
      'deletedBy',
    ];
    return auditFields.includes(fieldName);
  }

  /**
   * Format a property name as a human-readable label
   */
  private formatLabel(name: string): string {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .replace(/Grc /g, '')
      .trim();
  }

  /**
   * Get table description based on entity name
   */
  private getTableDescription(name: string): string | null {
    const descriptions: Record<string, string> = {
      GrcRisk: 'Risk register entries for tracking organizational risks',
      GrcControl: 'Controls that mitigate identified risks',
      GrcPolicy: 'Organizational policies and governance documents',
      GrcRequirement: 'Compliance requirements from various frameworks',
      GrcIssue: 'Audit findings and issues identified during assessments',
      GrcCapa: 'Corrective and Preventive Actions for addressing issues',
      GrcEvidence: 'Evidence artifacts supporting compliance activities',
      GrcAudit: 'Audit engagements and assessments',
      Standard: 'Compliance standards (ISO 27001, SOC 2, etc.)',
      StandardClause: 'Hierarchical clauses within compliance standards',
      Process: 'Business processes subject to controls',
      ProcessControl: 'Controls applied to business processes',
      ProcessViolation: 'Control failures and violations',
      Incident: 'IT service management incidents',
      User: 'Platform users',
      Tenant: 'Multi-tenant organizations',
    };

    return descriptions[name] || null;
  }

  /**
   * Get all tables in the data model
   */
  getAllTables(): DictionaryTable[] {
    this.initialize();
    return Array.from(this.tableCache.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }

  /**
   * Get a specific table by name
   */
  getTable(name: string): DictionaryTable | null {
    this.initialize();
    return this.tableCache.get(name) || null;
  }

  /**
   * Get tables filtered by criteria
   */
  getFilteredTables(options: {
    tenantScopedOnly?: boolean;
    withRelationships?: boolean;
    search?: string;
  }): DictionaryTable[] {
    this.initialize();

    let tables = Array.from(this.tableCache.values());

    if (options.tenantScopedOnly) {
      tables = tables.filter((t) => t.isTenantScoped);
    }

    if (options.withRelationships) {
      tables = tables.filter((t) => t.relationships.length > 0);
    }

    if (options.search) {
      const searchLower = options.search.toLowerCase();
      tables = tables.filter(
        (t) =>
          t.name.toLowerCase().includes(searchLower) ||
          t.label.toLowerCase().includes(searchLower) ||
          t.tableName.toLowerCase().includes(searchLower),
      );
    }

    return tables.sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * Get all relationships in the data model
   */
  getAllRelationships(): DictionaryRelationship[] {
    this.initialize();

    const relationships: DictionaryRelationship[] = [];
    for (const table of this.tableCache.values()) {
      relationships.push(...table.relationships);
    }

    return relationships;
  }

  /**
   * Get relationships for a specific table
   */
  getTableRelationships(tableName: string): DictionaryRelationship[] {
    this.initialize();

    const table = this.tableCache.get(tableName);
    if (!table) return [];

    return table.relationships;
  }

  /**
   * Get incoming relationships (tables that reference this table)
   */
  getIncomingRelationships(tableName: string): DictionaryRelationship[] {
    this.initialize();

    const incoming: DictionaryRelationship[] = [];
    for (const table of this.tableCache.values()) {
      for (const rel of table.relationships) {
        if (rel.targetTable === tableName) {
          incoming.push(rel);
        }
      }
    }

    return incoming;
  }

  /**
   * Generate dot-walking paths from a base table
   */
  getDotWalkingPaths(
    baseTable: string,
    maxDepth: number = 3,
  ): DotWalkPath[] {
    this.initialize();

    const paths: DotWalkPath[] = [];
    const visited = new Set<string>();

    this.buildDotWalkPaths(baseTable, [], visited, paths, maxDepth);

    return paths;
  }

  /**
   * Recursively build dot-walking paths
   */
  private buildDotWalkPaths(
    currentTable: string,
    currentSegments: DotWalkSegment[],
    visited: Set<string>,
    paths: DotWalkPath[],
    maxDepth: number,
  ): void {
    if (currentSegments.length >= maxDepth) return;
    if (visited.has(currentTable)) return;

    visited.add(currentTable);

    const table = this.tableCache.get(currentTable);
    if (!table) return;

    for (const rel of table.relationships) {
      if (
        rel.type === RelationshipType.MANY_TO_ONE ||
        rel.type === RelationshipType.ONE_TO_ONE
      ) {
        const newSegment: DotWalkSegment = {
          field: rel.name,
          targetTable: rel.targetTable,
          relationshipType: rel.type,
        };

        const newSegments = [...currentSegments, newSegment];
        const pathString = newSegments.map((s) => s.field).join('.');
        const reachableTables = newSegments.map((s) => s.targetTable);

        paths.push({
          path: pathString,
          segments: newSegments,
          reachableTables,
        });

        this.buildDotWalkPaths(
          rel.targetTable,
          newSegments,
          new Set(visited),
          paths,
          maxDepth,
        );
      }
    }
  }

  /**
   * Get data model summary for visualization
   */
  getDataModelSummary(): {
    totalTables: number;
    totalRelationships: number;
    tenantScopedTables: number;
    tablesWithSoftDelete: number;
    relationshipsByType: Record<RelationshipType, number>;
  } {
    this.initialize();

    const tables = Array.from(this.tableCache.values());
    const allRelationships = this.getAllRelationships();

    const relationshipsByType: Record<RelationshipType, number> = {
      [RelationshipType.ONE_TO_ONE]: 0,
      [RelationshipType.ONE_TO_MANY]: 0,
      [RelationshipType.MANY_TO_ONE]: 0,
      [RelationshipType.MANY_TO_MANY]: 0,
    };

    for (const rel of allRelationships) {
      relationshipsByType[rel.type]++;
    }

    return {
      totalTables: tables.length,
      totalRelationships: allRelationships.length,
      tenantScopedTables: tables.filter((t) => t.isTenantScoped).length,
      tablesWithSoftDelete: tables.filter((t) => t.hasSoftDelete).length,
      relationshipsByType,
    };
  }

  /**
   * Refresh the dictionary cache
   */
  refreshCache(): void {
    this.tableCache.clear();
    this.initialized = false;
    this.initialize();
  }
}
