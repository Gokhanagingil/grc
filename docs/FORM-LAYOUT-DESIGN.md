# Form Layout Engine Design Document

## Overview

The Form Layout Engine provides dynamic form rendering capabilities based on user roles. It allows administrators to configure field ordering, sections, hidden fields, and read-only fields without code changes.

## Entities

### Form Layout

Stores layout configurations per table and role.

```sql
CREATE TABLE form_layouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,        -- 'risks', 'policies', etc.
  role TEXT NOT NULL,              -- 'admin', 'manager', 'user', or '*' for all
  layout_json TEXT NOT NULL,       -- JSON layout configuration
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(table_name, role)
);
```

## Layout JSON Structure

```json
{
  "sections": [
    {
      "title": "Basic Information",
      "fields": ["title", "description", "category"]
    },
    {
      "title": "Risk Assessment",
      "fields": ["severity", "likelihood", "impact", "risk_score"]
    },
    {
      "title": "Management",
      "fields": ["owner_id", "assigned_to", "due_date", "status"]
    },
    {
      "title": "Mitigation",
      "fields": ["mitigation_plan"]
    }
  ],
  "hiddenFields": ["internal_notes", "confidential_assessment"],
  "readonlyFields": ["created_at", "updated_at", "risk_score"]
}
```

## Evaluation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Layout Resolution Request                     │
│         FormLayoutService.getLayout(tableName, userRoles)        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 1. Role Priority Resolution                      │
│                                                                  │
│   Priority order (highest to lowest):                            │
│   1. admin                                                       │
│   2. manager                                                     │
│   3. user                                                        │
│   4. * (wildcard/default)                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 2. Fetch Layout from Database                    │
│                                                                  │
│   SELECT * FROM form_layouts                                     │
│   WHERE table_name = ? AND role IN (userRoles)                   │
│   AND is_active = 1                                              │
│   ORDER BY priority                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 3. Return Layout or Default                      │
│                                                                  │
│   If layout found → Return layout_json                           │
│   If not found → Return default layout structure                 │
└─────────────────────────────────────────────────────────────────┘
```

## Default Layouts

### Risks Table
```json
{
  "sections": [
    {
      "title": "Basic Information",
      "fields": ["title", "description", "category"]
    },
    {
      "title": "Risk Assessment",
      "fields": ["severity", "likelihood", "impact", "risk_score"]
    },
    {
      "title": "Management",
      "fields": ["owner_id", "assigned_to", "due_date", "status"]
    },
    {
      "title": "Mitigation",
      "fields": ["mitigation_plan"]
    }
  ],
  "hiddenFields": [],
  "readonlyFields": ["created_at", "updated_at", "risk_score"]
}
```

### Policies Table
```json
{
  "sections": [
    {
      "title": "Policy Details",
      "fields": ["title", "description", "category", "version"]
    },
    {
      "title": "Ownership",
      "fields": ["owner_id", "status"]
    },
    {
      "title": "Dates",
      "fields": ["effective_date", "review_date"]
    },
    {
      "title": "Content",
      "fields": ["content"]
    }
  ],
  "hiddenFields": [],
  "readonlyFields": ["created_at", "updated_at", "version"]
}
```

### Compliance Requirements Table
```json
{
  "sections": [
    {
      "title": "Requirement Details",
      "fields": ["title", "description", "regulation", "category"]
    },
    {
      "title": "Assignment",
      "fields": ["owner_id", "assigned_to", "status"]
    },
    {
      "title": "Timeline",
      "fields": ["due_date"]
    },
    {
      "title": "Evidence",
      "fields": ["evidence"]
    }
  ],
  "hiddenFields": [],
  "readonlyFields": ["created_at", "updated_at"]
}
```

## Frontend Integration

### useFormLayout Hook

```typescript
import { useFormLayout } from '../hooks/useFormLayout';

function RiskForm({ risk }) {
  const {
    layout,
    isLoading,
    isFieldHidden,
    isFieldReadonly,
    getSections
  } = useFormLayout('risks');

  if (isLoading) return <Loading />;

  return (
    <form>
      {getSections().map(section => (
        <Section key={section.title} title={section.title}>
          {section.fields.map(field => (
            !isFieldHidden(field) && (
              <Field
                key={field}
                name={field}
                value={risk[field]}
                readonly={isFieldReadonly(field)}
              />
            )
          ))}
        </Section>
      ))}
    </form>
  );
}
```

### Layout Application

```typescript
const result = FormLayoutService.applyLayout(layout, formData, 'edit');
// Returns:
// {
//   sections: [...],
//   hiddenFields: [...],
//   readonlyFields: [...],
//   data: { ...formData }
// }
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/platform/form-layouts` | Get all layouts |
| GET | `/api/platform/form-layouts/tables` | Get tables with layouts |
| GET | `/api/platform/form-layouts/table/:tableName` | Get layouts for table |
| GET | `/api/platform/form-layouts/resolve/:tableName` | Get resolved layout for user |
| GET | `/api/platform/form-layouts/default/:tableName` | Get default layout |
| POST | `/api/platform/form-layouts` | Create layout |
| PUT | `/api/platform/form-layouts/:id` | Update layout |
| DELETE | `/api/platform/form-layouts/:id` | Delete layout |
| POST | `/api/platform/form-layouts/apply` | Apply layout to form data |

## Example Configurations

### Admin Layout (Full Access)
```json
{
  "table_name": "risks",
  "role": "admin",
  "layout_json": {
    "sections": [
      {
        "title": "All Fields",
        "fields": ["title", "description", "category", "severity", "likelihood", 
                   "impact", "risk_score", "owner_id", "assigned_to", "due_date", 
                   "status", "mitigation_plan", "internal_notes", "confidential_assessment"]
      }
    ],
    "hiddenFields": [],
    "readonlyFields": ["created_at", "updated_at"]
  }
}
```

### User Layout (Limited Access)
```json
{
  "table_name": "risks",
  "role": "user",
  "layout_json": {
    "sections": [
      {
        "title": "Risk Overview",
        "fields": ["title", "description", "category", "severity", "status"]
      },
      {
        "title": "Assignment",
        "fields": ["assigned_to", "due_date"]
      }
    ],
    "hiddenFields": ["internal_notes", "confidential_assessment", "mitigation_plan"],
    "readonlyFields": ["title", "description", "category", "severity", "status", 
                       "created_at", "updated_at"]
  }
}
```

## Future Enhancements

1. **UI Layout Editor**: Visual drag-and-drop editor for creating layouts.

2. **Conditional Sections**: Show/hide sections based on field values.

3. **Field Grouping**: Group related fields with collapsible panels.

4. **Custom Field Rendering**: Support for custom field renderers (rich text, file upload, etc.).

5. **Layout Inheritance**: Allow layouts to inherit from parent layouts.

6. **Layout Versioning**: Track changes to layouts over time.
