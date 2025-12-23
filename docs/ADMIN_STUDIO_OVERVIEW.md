# Admin Studio Overview (FAZ 2)

## Purpose

The Admin Studio is a platform administration interface designed to make the GRC Platform self-describing to administrators. It provides visibility into the platform's data model, dictionary metadata, and entity relationships.

## i18n Foundation

FAZ 2 establishes the i18n (internationalization) foundation for the Admin Studio. All user-facing text uses translation keys that can be localized in future phases.

**Key Points:**
- All UI text uses translation keys (e.g., `admin.data_model.title`, `admin.dictionary.fields`)
- Dictionary metadata (table names, field names) remains language-neutral
- Display labels are conceptually separate from technical identifiers
- Translation keys are defined in `/frontend/src/i18n/keys.ts`

**What is NOT included in FAZ 2:**
- Full translation coverage
- Language switch UI
- Translation management screens
- Existing content translation

The i18n foundation ensures future localization can be added without refactoring data structures.

## What Admin Studio Covers in FAZ 2

### Data Model Explorer

The Data Model Explorer is the primary feature of FAZ 2, providing administrators with a comprehensive view of the platform's data structure.

**Capabilities:**

1. **Table Discovery**: View all tables/entities in the platform with their metadata including tenant-scoping, soft delete support, and audit field presence.

2. **Field Inspection**: Examine field-level metadata for any table including data types, constraints (required, nullable, primary key), default values, and enum options.

3. **Relationship Visualization**: See how tables relate to each other through a visual representation showing relationship types (1:1, 1:N, N:1, M:N).

4. **Dot-Walking Preview**: Preview reference traversal paths from any base table, useful for understanding data relationships for reporting and workflow configuration.

### Dictionary Core

The backend dictionary service provides metadata about the platform's data model derived from TypeORM entity definitions.

**Metadata Captured:**

- Table name, label, and description
- Tenant-scoping flag
- Soft delete support
- Audit field presence
- Field definitions with types, constraints, and options
- Relationship definitions with types and targets

## What Admin Studio Does NOT Cover in FAZ 2

The following features are explicitly out of scope for FAZ 2:

1. **Workflow Designer**: No workflow automation or business rule configuration
2. **UI Policy Editor**: No UI policy or form layout customization
3. **Schema Modification**: No ability to create, modify, or delete tables/fields
4. **Migration Management**: No database migration tools or schema versioning
5. **GRC/ITSM Module Configuration**: No module-specific settings or customization

## How to Use Data Model Explorer in Demos

### Demo Scenario 1: Platform Overview

1. Navigate to Admin → Data Model
2. Show the summary cards displaying total tables, relationships, and tenant-scoped entities
3. Highlight the platform's multi-tenancy architecture by filtering to tenant-scoped tables

### Demo Scenario 2: Entity Deep Dive

1. Select a key entity (e.g., GrcRisk, GrcPolicy, GrcAudit)
2. Walk through the Fields tab showing field types and constraints
3. Switch to Relationships tab to show connected entities
4. Use the Visual Graph tab to demonstrate the entity's position in the data model

### Demo Scenario 3: Dot-Walking for Reporting

1. Select a base table (e.g., GrcIssue)
2. Navigate to the Dot-Walking tab
3. Show available traversal paths (e.g., issue → audit → owner)
4. Explain how these paths can be used in reports and workflows

### Demo Talking Points

- "The platform is metadata-driven - what you see here is the actual data model, not documentation"
- "All entities support multi-tenancy with complete data isolation"
- "Soft delete ensures audit trails are preserved"
- "Dot-walking paths enable powerful reporting across related data"

## Access Requirements

- User must have admin role
- User must be authenticated with valid JWT token
- Tenant context must be established

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/data-model/tables` | GET | List all tables with optional filtering |
| `/admin/data-model/tables/:name` | GET | Get specific table details |
| `/admin/data-model/tables/:name/relationships` | GET | Get table relationships |
| `/admin/data-model/tables/:name/dot-walking` | GET | Get dot-walking paths |
| `/admin/data-model/relationships` | GET | List all relationships |
| `/admin/data-model/summary` | GET | Get data model statistics |
| `/admin/data-model/graph` | GET | Get graph data for visualization |
| `/admin/data-model/refresh` | GET | Refresh dictionary cache |

## Navigation

Access the Data Model Explorer via:
- Main navigation: Admin → Data Model
- Direct URL: `/admin/data-model`
