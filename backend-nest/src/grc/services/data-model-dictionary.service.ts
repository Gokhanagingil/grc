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
 * Dictionary relationship type enumeration (TypeORM cardinality)
 */
export enum DictionaryRelationshipType {
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
  defaultValue: unknown;
  enumValues: string[] | null;
  referenceTarget: string | null;
  maxLength: number | null;
}

/**
 * Dictionary relationship metadata
 */
export interface DictionaryRelationship {
  name: string;
  type: DictionaryRelationshipType;
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
  relationshipType: DictionaryRelationshipType;
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

    const primaryKeyField = metadata.primaryColumns[0]?.propertyName || 'id';

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
        enumValues: column.enum
          ? (Object.values(column.enum) as string[])
          : null,
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
        isCascade:
          relation.isCascadeInsert ||
          relation.isCascadeUpdate ||
          relation.isCascadeRemove ||
          relation.isCascadeSoftRemove ||
          relation.isCascadeRecover,
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
  private mapRelationType(type: string): DictionaryRelationshipType {
    const typeMap: Record<string, DictionaryRelationshipType> = {
      'one-to-one': DictionaryRelationshipType.ONE_TO_ONE,
      'one-to-many': DictionaryRelationshipType.ONE_TO_MANY,
      'many-to-one': DictionaryRelationshipType.MANY_TO_ONE,
      'many-to-many': DictionaryRelationshipType.MANY_TO_MANY,
    };

    return typeMap[type] || DictionaryRelationshipType.MANY_TO_ONE;
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
  getDotWalkingPaths(baseTable: string, maxDepth: number = 3): DotWalkPath[] {
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
        rel.type === DictionaryRelationshipType.MANY_TO_ONE ||
        rel.type === DictionaryRelationshipType.ONE_TO_ONE
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
    relationshipsByType: Record<DictionaryRelationshipType, number>;
  } {
    this.initialize();

    const tables = Array.from(this.tableCache.values());
    const allRelationships = this.getAllRelationships();

    const relationshipsByType: Record<DictionaryRelationshipType, number> = {
      [DictionaryRelationshipType.ONE_TO_ONE]: 0,
      [DictionaryRelationshipType.ONE_TO_MANY]: 0,
      [DictionaryRelationshipType.MANY_TO_ONE]: 0,
      [DictionaryRelationshipType.MANY_TO_MANY]: 0,
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

  /**
   * Get schema for dot-walking query builder
   * Returns entities, fields, and relationships in a format suitable for the frontend
   */
  getDotWalkingSchema(): {
    entities: string[];
    fields: Record<string, string[]>;
    relationships: Record<
      string,
      Record<string, { entity: string; foreignKey: string; type: string }>
    >;
  } {
    this.initialize();

    const entities: string[] = [];
    const fields: Record<string, string[]> = {};
    const relationships: Record<
      string,
      Record<string, { entity: string; foreignKey: string; type: string }>
    > = {};

    for (const table of this.tableCache.values()) {
      // Use lowercase entity name for consistency with frontend
      const entityName = table.name.toLowerCase().replace('grc', '');
      entities.push(entityName);

      // Get field names for this entity
      fields[entityName] = table.fields.map((f) => f.name);

      // Get relationships for this entity
      relationships[entityName] = {};
      for (const rel of table.relationships) {
        const targetName = rel.targetTable.toLowerCase().replace('grc', '');
        relationships[entityName][rel.name] = {
          entity: targetName,
          foreignKey: rel.sourceField,
          type: rel.type,
        };
      }
    }

    return { entities, fields, relationships };
  }

  /**
   * Get suggestions for dot-walking path completion
   */
  getDotWalkingSuggestions(currentPath: string): string[] {
    this.initialize();

    if (!currentPath) {
      // Return all entity names as suggestions
      return Array.from(this.tableCache.values()).map((t) =>
        t.name.toLowerCase().replace('grc', ''),
      );
    }

    const parts = currentPath.split('.');
    const lastPart = parts[parts.length - 1] || '';
    const basePath = parts.slice(0, -1).join('.');

    // Find the current entity based on the path
    let currentEntity: string | null = null;

    if (basePath) {
      // Navigate through the path to find the current entity
      const pathParts = basePath.split('.');
      let entity = this.findEntityByName(pathParts[0]);

      for (let i = 1; i < pathParts.length && entity; i++) {
        const rel = entity.relationships.find(
          (r) => r.name.toLowerCase() === pathParts[i].toLowerCase(),
        );
        if (rel) {
          entity = this.tableCache.get(rel.targetTable) || null;
        } else {
          entity = null;
        }
      }

      if (entity) {
        currentEntity = entity.name;
      }
    } else if (parts.length === 1) {
      // First part - suggest entities or fields of first entity
      const entity = this.findEntityByName(lastPart);
      if (entity) {
        currentEntity = entity.name;
      }
    }

    const suggestions: string[] = [];

    if (currentEntity) {
      const entity = this.tableCache.get(currentEntity);
      if (entity) {
        // Suggest fields
        for (const field of entity.fields) {
          if (field.name.toLowerCase().startsWith(lastPart.toLowerCase())) {
            suggestions.push(field.name);
          }
        }
        // Suggest relationships
        for (const rel of entity.relationships) {
          if (rel.name.toLowerCase().startsWith(lastPart.toLowerCase())) {
            suggestions.push(rel.name);
          }
        }
      }
    } else {
      // Suggest entities
      for (const table of this.tableCache.values()) {
        const entityName = table.name.toLowerCase().replace('grc', '');
        if (entityName.startsWith(lastPart.toLowerCase())) {
          suggestions.push(entityName);
        }
      }
    }

    return suggestions;
  }

  /**
   * Find entity by name (case-insensitive, handles 'grc' prefix)
   */
  private findEntityByName(name: string): DictionaryTable | null {
    const normalizedName = name.toLowerCase();

    for (const table of this.tableCache.values()) {
      const tableName = table.name.toLowerCase();
      const shortName = tableName.replace('grc', '');

      if (tableName === normalizedName || shortName === normalizedName) {
        return table;
      }
    }

    return null;
  }

  /**
   * Validate a dot-walking path
   */
  validateDotWalkingPath(path: string): {
    valid: boolean;
    error: string | null;
    segments: Array<{
      type: string;
      value: string;
      entity?: string;
      targetEntity?: string;
      relationshipType?: string;
    }>;
    depth: number;
  } {
    this.initialize();

    if (!path || path.trim() === '') {
      return {
        valid: false,
        error: 'Path cannot be empty',
        segments: [],
        depth: 0,
      };
    }

    const parts = path.split('.');
    const segments: Array<{
      type: string;
      value: string;
      entity?: string;
      targetEntity?: string;
      relationshipType?: string;
    }> = [];

    // First part should be an entity
    const rootEntity = this.findEntityByName(parts[0]);
    if (!rootEntity) {
      return {
        valid: false,
        error: `Unknown entity: ${parts[0]}`,
        segments: [],
        depth: 0,
      };
    }

    segments.push({
      type: 'entity',
      value: parts[0],
      entity: rootEntity.name,
    });

    let currentEntity = rootEntity;
    let depth = 0;

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];

      // Check if it's a relationship
      const rel = currentEntity.relationships.find(
        (r) => r.name.toLowerCase() === part.toLowerCase(),
      );

      if (rel) {
        depth++;
        const targetEntity = this.tableCache.get(rel.targetTable);
        if (!targetEntity) {
          return {
            valid: false,
            error: `Target entity not found for relationship: ${part}`,
            segments,
            depth,
          };
        }

        segments.push({
          type: 'relationship',
          value: part,
          entity: currentEntity.name,
          targetEntity: targetEntity.name,
          relationshipType: rel.type,
        });

        currentEntity = targetEntity;
        continue;
      }

      // Check if it's a field
      const field = currentEntity.fields.find(
        (f) => f.name.toLowerCase() === part.toLowerCase(),
      );

      if (field) {
        segments.push({
          type: 'field',
          value: part,
          entity: currentEntity.name,
        });
        continue;
      }

      // Unknown part
      return {
        valid: false,
        error: `Unknown field or relationship '${part}' on entity '${currentEntity.name}'`,
        segments,
        depth,
      };
    }

    return {
      valid: true,
      error: null,
      segments,
      depth,
    };
  }

  /**
   * Test a dot-walking path (returns sample data structure, not actual data)
   */
  testDotWalkingPath(path: string): {
    valid: boolean;
    error?: string;
    path?: string;
    depth?: number;
    sampleData?: Array<Record<string, unknown>>;
    sampleCount?: number;
    suggestions?: string[];
  } {
    const validation = this.validateDotWalkingPath(path);

    if (!validation.valid) {
      // Get suggestions for the last valid segment
      const parts = path.split('.');
      const suggestions = this.getDotWalkingSuggestions(
        parts.slice(0, -1).join('.'),
      );

      return {
        valid: false,
        error: validation.error || 'Invalid path',
        suggestions: suggestions.slice(0, 5),
      };
    }

    // Generate sample data structure based on the path
    const sampleData: Array<Record<string, unknown>> = [];
    const lastSegment = validation.segments[validation.segments.length - 1];

    if (lastSegment) {
      // Create sample records
      for (let i = 0; i < 3; i++) {
        const record: Record<string, unknown> = {};

        if (lastSegment.type === 'field') {
          record[lastSegment.value] = `Sample value ${i + 1}`;
        } else if (
          lastSegment.type === 'relationship' &&
          lastSegment.targetEntity
        ) {
          const targetTable = this.tableCache.get(lastSegment.targetEntity);
          if (targetTable) {
            for (const field of targetTable.fields.slice(0, 3)) {
              record[field.name] = `Sample ${field.name} ${i + 1}`;
            }
          }
        } else if (lastSegment.type === 'entity' && lastSegment.entity) {
          const entityTable = this.tableCache.get(lastSegment.entity);
          if (entityTable) {
            for (const field of entityTable.fields.slice(0, 3)) {
              record[field.name] = `Sample ${field.name} ${i + 1}`;
            }
          }
        }

        sampleData.push(record);
      }
    }

    return {
      valid: true,
      path,
      depth: validation.depth,
      sampleData,
      sampleCount: sampleData.length,
    };
  }
}
