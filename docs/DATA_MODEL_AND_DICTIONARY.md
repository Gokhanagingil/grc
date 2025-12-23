# Data Model and Dictionary (FAZ 2)

## Overview

The Data Model Dictionary is a metadata-driven system that provides introspection capabilities for the GRC Platform's data model. It derives metadata from TypeORM entity definitions and exposes it through a structured API for use by the Admin Studio.

## Dictionary Concepts

### Tables (Entities)

Tables represent the core data structures in the platform. Each table has the following metadata:

| Property | Description |
|----------|-------------|
| `name` | Entity class name (e.g., `GrcRisk`) |
| `tableName` | Database table name (e.g., `grc_risks`) |
| `label` | Human-readable label (e.g., `Risk`) |
| `description` | Optional description of the table's purpose |
| `isTenantScoped` | Whether the table has tenant isolation |
| `hasSoftDelete` | Whether the table uses soft deletion |
| `hasAuditFields` | Whether the table has audit tracking fields |
| `primaryKeyField` | Name of the primary key field |

### Fields

Fields represent columns within a table. Each field has the following metadata:

| Property | Description |
|----------|-------------|
| `name` | Property name in the entity |
| `columnName` | Database column name |
| `type` | Data type (string, integer, boolean, etc.) |
| `label` | Human-readable label |
| `isRequired` | Whether the field is required |
| `isNullable` | Whether the field accepts null values |
| `isPrimaryKey` | Whether the field is the primary key |
| `isGenerated` | Whether the field is auto-generated |
| `isAuditField` | Whether the field is an audit tracking field |
| `isTenantScoped` | Whether the field is the tenant ID |
| `defaultValue` | Default value if any |
| `enumValues` | List of allowed values for enum fields |
| `maxLength` | Maximum length for string fields |

### Field Types

The dictionary supports the following field types:

| Type | Description | Example |
|------|-------------|---------|
| `string` | Short text (varchar) | `title`, `name` |
| `text` | Long text | `description`, `notes` |
| `integer` | Whole numbers | `count`, `priority` |
| `decimal` | Decimal numbers | `score`, `amount` |
| `boolean` | True/false values | `isActive`, `isDeleted` |
| `date` | Date only | `dueDate` |
| `datetime` | Date and time | `createdAt`, `updatedAt` |
| `uuid` | Universally unique identifier | `id`, `tenantId` |
| `enum` | Enumerated values | `status`, `severity` |
| `json` | JSON/JSONB data | `metadata`, `config` |

## Relationship Concepts

### Relationship Types

The dictionary tracks four types of relationships:

| Type | Symbol | Description |
|------|--------|-------------|
| One-to-One | 1:1 | Single record on both sides |
| One-to-Many | 1:N | One parent, many children |
| Many-to-One | N:1 | Many children, one parent (reference) |
| Many-to-Many | M:N | Many records on both sides |

### Relationship Metadata

Each relationship has the following properties:

| Property | Description |
|----------|-------------|
| `name` | Relationship property name |
| `type` | Relationship type (1:1, 1:N, N:1, M:N) |
| `sourceTable` | Table where the relationship is defined |
| `sourceField` | Field name in the source table |
| `targetTable` | Related table |
| `targetField` | Field name in the target table |
| `isNullable` | Whether the relationship is optional |
| `isCascade` | Whether operations cascade to related records |
| `inverseRelationship` | Name of the inverse relationship if defined |

## Visual Model Derivation

The visual data model in the Admin Studio is derived entirely from dictionary metadata, not from database introspection or hardcoded definitions.

### Visual Graph Implementation (FAZ 2)

The Visual Data Model Explorer uses ReactFlow, a powerful React library for building node-based graphs and diagrams. This provides an interactive, demo-ready visualization of the data model.

**Features:**
- **Interactive Nodes**: Tables are rendered as draggable nodes showing table name, field count, and metadata indicators (tenant-scoped, soft delete)
- **Relationship Edges**: Relationships are rendered as edges with type labels (1:1, 1:N, N:1, M:N) and distinct colors
- **Click Interactions**: Clicking a node selects the table; clicking an edge shows relationship details
- **Navigation Controls**: Zoom, pan, fit view, and minimap for large data models
- **Focused View**: When a table is selected, the graph shows only that table and its directly related tables

**Component Location**: `/frontend/src/components/admin/DataModelGraph.tsx`

### Data Flow

```
TypeORM Entities → DataModelDictionaryService → API Endpoints → Frontend Components
```

### Initialization Process

1. On first API request, the `DataModelDictionaryService` initializes
2. It reads TypeORM's `EntityMetadata` for all registered entities
3. For each entity, it extracts:
   - Column definitions → Field metadata
   - Relation definitions → Relationship metadata
   - Table configuration → Table metadata
4. Metadata is cached in memory for performance
5. Cache can be refreshed via the `/admin/data-model/refresh` endpoint

### Graph Generation

The visual graph is generated from:
- **Nodes**: Each table becomes a node with its label and properties
- **Edges**: Each relationship becomes an edge connecting source to target

## Dot-Walking

Dot-walking is a technique for traversing relationships to access related data. It's commonly used in reporting and workflow configurations.

### Path Notation

Paths are expressed using dot notation:
```
baseTable.relationship1.relationship2.field
```

Example:
```
incident.caller.department.costCenter
```

This path traverses:
1. Start at `incident`
2. Follow `caller` relationship to `User`
3. Follow `department` relationship to `Department`
4. Access `costCenter` field

### Path Generation

The dictionary service generates all possible dot-walking paths from a base table up to a configurable depth (default: 3 levels).

Only reference relationships (Many-to-One, One-to-One) are followed to ensure deterministic single-value results.

### Use Cases

- **Reporting**: Include related data in reports without complex joins
- **Workflows**: Reference related data in workflow conditions and actions
- **Form Fields**: Display related data in form layouts
- **Notifications**: Include context from related records in notifications

## Limitations of FAZ 2 Implementation

### Current Limitations

1. **Read-Only**: The dictionary is read-only; no schema modifications are possible
2. **No Custom Metadata**: Cannot add custom metadata beyond what TypeORM provides
3. **No Field-Level Permissions**: All fields are visible to admins
4. **No Relationship Editing**: Cannot modify relationships through the UI
5. **Memory-Based Cache**: Cache is not persisted; rebuilds on service restart
6. **No Versioning**: No tracking of schema changes over time

### Deferred to FAZ 3+

1. **Schema Editor**: Ability to create/modify tables and fields
2. **Custom Metadata**: Add custom labels, descriptions, and tags
3. **Field-Level Security**: Control field visibility by role
4. **Relationship Designer**: Visual relationship creation/editing
5. **Schema Versioning**: Track and compare schema changes
6. **Migration Generation**: Auto-generate migrations from schema changes
7. **Data Dictionary Export**: Export dictionary to documentation formats

## API Reference

### List Tables

```
GET /admin/data-model/tables
```

Query Parameters:
- `tenantScopedOnly` (boolean): Filter to tenant-scoped tables
- `withRelationships` (boolean): Filter to tables with relationships
- `search` (string): Search by name, label, or table name

### Get Table

```
GET /admin/data-model/tables/:name
```

Returns complete table metadata including fields and relationships.

### Get Dot-Walking Paths

```
GET /admin/data-model/tables/:name/dot-walking
```

Query Parameters:
- `maxDepth` (number, 1-5): Maximum traversal depth (default: 3)

### Get Graph Data

```
GET /admin/data-model/graph
```

Returns nodes and edges for visualization.

### Get Summary

```
GET /admin/data-model/summary
```

Returns aggregate statistics about the data model.

## Security Considerations

- All endpoints require admin role (`GRC_ADMIN` permission)
- All endpoints require valid JWT authentication
- All endpoints require tenant context
- No sensitive data is exposed through the dictionary
- Database credentials and connection details are not exposed
