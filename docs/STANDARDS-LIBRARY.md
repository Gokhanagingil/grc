# Standards Library

The Standards Library is a comprehensive system for managing global compliance standards and regulatory frameworks within the GRC platform. It provides a centralized repository for standards like ISO 27001, ISO 27002, COBIT 2019, NIST CSF, KVKK/GDPR, ISO 20000, and ISO 9001.

## Overview

The Standards Library extends the existing compliance requirements model to support structured standards data with hierarchical organization, versioning, and cross-referencing capabilities.

## Database Schema

The compliance_requirements table has been extended with the following fields:

| Field | Type | Description |
|-------|------|-------------|
| family | enum | Standard family (iso27001, iso27002, iso20000, iso9001, cobit2019, nistcsf, kvkk, gdpr) |
| code | string | Control/clause code (e.g., A.5.1, DSS01.04, PR.DS-01) |
| version | string | Standard version (e.g., 2022, 2019, 1.1) |
| hierarchy_level | enum | Level in hierarchy (clause, control, subcontrol) |
| domain | string | Domain classification (security, privacy, itservice, quality) |
| description_long | text | Extended description with detailed guidance |

All new fields are nullable to maintain backward compatibility with existing requirements.

## Standards Data Files

Standards data is stored in JSON format under `/backend/data/standards/`:

- `iso27001.json` - ISO/IEC 27001:2022 Information Security Management
- `iso27002.json` - ISO/IEC 27002:2022 Information Security Controls
- `iso20000.json` - ISO/IEC 20000-1:2018 IT Service Management
- `iso9001.json` - ISO 9001:2015 Quality Management
- `cobit2019.json` - COBIT 2019 IT Governance Framework
- `nistcsf.json` - NIST Cybersecurity Framework 2.0
- `kvkk-gdpr.json` - KVKK/GDPR Privacy Regulations

### JSON Schema

Each standards file follows this structure:

```json
{
  "family": "iso27001",
  "version": "2022",
  "name": "ISO/IEC 27001:2022",
  "description": "Information security management systems",
  "requirements": [
    {
      "code": "A.5.1",
      "title": "Policies for information security",
      "description": "Short description",
      "description_long": "Detailed guidance text",
      "hierarchy_level": "control",
      "domain": "security",
      "category": "Organizational controls",
      "regulation": "ISO 27001:2022",
      "metadata_tags": ["security", "governance"]
    }
  ]
}
```

## Standards Importer

The standards importer script (`/backend/scripts/import-standards.js`) reads JSON files and populates the database.

### Running the Importer

```bash
cd backend
node scripts/import-standards.js
```

### Features

- Idempotent operation (safe to run multiple times)
- Automatic duplicate detection using code + family + version
- Updates existing records if content has changed
- Assigns default metadata tags to imported requirements
- Detailed logging with summary statistics

### Import Summary

The importer outputs:
- Number of new records created
- Number of records updated
- Number of records skipped (no changes)
- Number of metadata tag assignments
- Any errors encountered

## API Endpoints

### List Standards

```
GET /api/grc/requirements
```

Query parameters:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 25)
- `search` - Text search in code, title, description
- `family` - Filter by standard family
- `version` - Filter by version
- `domain` - Filter by domain
- `category` - Filter by category
- `hierarchy_level` - Filter by hierarchy level
- `sort` - Sort field (default: code)
- `order` - Sort order (asc/desc)

### Get Filter Options

```
GET /api/grc/requirements/filters
```

Returns available filter values:
- families
- versions
- domains
- categories
- hierarchyLevels

### Get Requirement Details

```
GET /api/grc/requirements/:id
```

Returns full requirement details including all mappings.

## Frontend UI

### Standards Library Page

Located at `/standards`, this page provides:
- Filterable table of all standards
- Search by code, title, or description
- Filter by family, version, domain
- Pagination support
- Click-through to detail view

### Requirement Detail Page

Located at `/standards/:id`, this page shows:
- Full requirement information
- Long description with detailed guidance
- Metadata tags
- Mapped policies, risks, findings, and audits
- Actions to create new mappings

## Integration with Other Modules

The Standards Library integrates with:
- **Metadata Engine** - Tag requirements with custom metadata
- **Requirement Mapping** - Link requirements to policies, risks, findings, audits
- **Metrics Dashboard** - Coverage and compliance statistics

## Best Practices

1. **Regular Updates**: Re-run the importer when standards are updated
2. **Consistent Tagging**: Use metadata tags for cross-cutting concerns
3. **Complete Mappings**: Map requirements to relevant policies and controls
4. **Version Tracking**: Maintain version information for audit trails
