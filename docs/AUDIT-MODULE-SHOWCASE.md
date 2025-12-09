# Audit Module Showcase

This document explains how the Audit module demonstrates the Platform Core Phase 2 capabilities including ACL, Form Layout, UI Policy, Module Licensing, and Search DSL.

## Overview

The Audit module is a complete "showcase module" that uses ALL new platform core capabilities end-to-end. It serves as a reference implementation for building other GRC modules.

## Features Demonstrated

### 1. Module Licensing / Visibility

The Audit module visibility is controlled by the `ModuleService`:

**Backend:**
- Module key: `audit`
- Controlled via `tenant_modules` table
- Demo tenant configurations:
  - `demo-full`: Audit module enabled
  - `demo-basic`: Audit module disabled

**Frontend:**
- Menu item visibility controlled by `moduleKey: 'audit'` in `Layout.tsx`
- Route protection via `ModuleGuard` component
- Graceful fallback when module is disabled

**API Endpoints:**
```
GET /api/platform/modules/enabled - Get enabled modules for current tenant
GET /api/platform/modules/:moduleKey/status - Check specific module status
```

### 2. Access Control List (ACL)

The Audit module implements comprehensive ACL:

**Permission-Based Access:**
- `audits.read` - View audits
- `audits.write` - Create/update audits
- `audits.delete` - Delete audits
- `audits.assign` - Assign auditors
- `audits.close` - Close audits

**Role Permissions:**
| Role    | Permissions                              |
|---------|------------------------------------------|
| admin   | read, write, delete, assign, close       |
| manager | read, write, assign, close               |
| user    | read                                     |

**Record-Level ACL Rules:**
1. **Owner Access**: Audit owners can edit their own audits
2. **Lead Auditor Access**: Lead auditors can edit assigned audits
3. **Field Masking**: Sensitive fields (findings, recommendations, conclusion) hidden from regular users
4. **Department-Based Access**: Users can view audits in their department

**API Endpoints:**
```
GET /api/grc/audits/:id/permissions - Get user's permissions for specific audit
GET /api/grc/audits/can/create - Check if user can create audits
```

**Example ACL Check Response:**
```json
{
  "read": true,
  "write": true,
  "delete": false,
  "maskedFields": ["findings_summary", "recommendations"],
  "deniedFields": []
}
```

### 3. Form Layout Engine

The Audit module uses role-based form layouts:

**Layout Configurations:**
- `user` role: Basic Info, Schedule, Scope & Objectives sections; hides findings/recommendations/conclusion
- `manager` role: All sections including findings; no hidden fields
- `admin` role: All sections including metadata; no hidden fields

**Sections:**
1. **Basic Information**: name, audit_type, status, risk_level, department, lead_auditor, description
2. **Schedule**: planned_start_date, planned_end_date, actual_start_date, actual_end_date
3. **Scope & Objectives**: scope, objectives, methodology
4. **Findings & Conclusions**: findings_summary, recommendations, conclusion
5. **Metadata** (admin only): created_at, updated_at, owner info

**API Endpoints:**
```
GET /api/platform/form-layouts/:tableName - Get layout for table
GET /api/platform/form-layouts/:tableName/:role - Get role-specific layout
```

### 4. UI Policy Engine

The Audit module implements dynamic UI policies:

**Configured Policies:**

| Policy | Condition | Action |
|--------|-----------|--------|
| Readonly when closed | status = 'closed' | Make all fields readonly |
| Hide findings when planned | status = 'planned' | Hide findings_summary, recommendations, conclusion |
| Require scope for high risk | risk_level = 'high' | Make scope, objectives, methodology mandatory |
| Require lead auditor for critical | risk_level = 'critical' | Make lead_auditor_id mandatory |
| Name always mandatory | Always | Make name mandatory |
| Show actual dates in progress | status = 'in_progress' | Show and require actual_start_date |

**Frontend Integration:**
```typescript
const { evaluateActions } = useUiPolicy('audits');

useEffect(() => {
  const actions = evaluateActions(formData);
  setUiActions({
    hiddenFields: actions.filter(a => a.action === 'hide').map(a => a.field),
    readonlyFields: actions.filter(a => a.action === 'readonly').map(a => a.field),
    mandatoryFields: actions.filter(a => a.action === 'mandatory').map(a => a.field),
  });
}, [formData, evaluateActions]);
```

**API Endpoints:**
```
GET /api/platform/ui-policies/:tableName - Get policies for table
POST /api/platform/ui-policies/evaluate - Evaluate policies for record
```

### 5. Search DSL Integration

The Audit module uses the Search DSL for filtering:

**Supported Operators:**
- `equals`, `not_equals`
- `contains`, `starts_with`, `ends_with`
- `greater_than`, `greater_than_or_equals`
- `less_than`, `less_than_or_equals`
- `in`, `not_in`
- `is_null`, `is_not_null`
- `between`

**Logical Operators:**
- `and` - All conditions must match
- `or` - Any condition must match
- `not` - Negate condition

**Example Search Query:**
```json
{
  "filter": {
    "and": [
      { "field": "status", "operator": "in", "value": ["planned", "in_progress"] },
      { "field": "risk_level", "operator": "equals", "value": "high" },
      {
        "or": [
          { "field": "department", "operator": "equals", "value": "IT" },
          { "field": "department", "operator": "equals", "value": "Finance" }
        ]
      }
    ]
  },
  "sort": { "field": "planned_start_date", "direction": "ASC" },
  "page": 1,
  "limit": 10
}
```

**API Endpoints:**
```
GET /api/grc/audits - List with query params (simple filtering)
POST /api/grc/audits/search - Search with DSL body (complex filtering)
GET /api/grc/audits/metadata - Get field metadata for filter UI
GET /api/grc/audits/distinct/:field - Get distinct values for dropdown
```

## API Reference

### Audit Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/grc/audits` | List audits with pagination and filters |
| POST | `/api/grc/audits/search` | Search audits with DSL query |
| GET | `/api/grc/audits/metadata` | Get field metadata |
| GET | `/api/grc/audits/distinct/:field` | Get distinct field values |
| GET | `/api/grc/audits/statistics` | Get audit statistics |
| GET | `/api/grc/audits/can/create` | Check create permission |
| GET | `/api/grc/audits/:id` | Get audit by ID |
| POST | `/api/grc/audits` | Create new audit |
| PUT | `/api/grc/audits/:id` | Update audit |
| DELETE | `/api/grc/audits/:id` | Delete audit |
| GET | `/api/grc/audits/:id/permissions` | Get user permissions for audit |

### Example Payloads

**Create Audit:**
```json
{
  "name": "Q4 2024 Financial Audit",
  "description": "Annual financial audit for Q4",
  "audit_type": "internal",
  "status": "planned",
  "risk_level": "medium",
  "department": "Finance",
  "lead_auditor_id": 2,
  "planned_start_date": "2024-10-01",
  "planned_end_date": "2024-10-31",
  "scope": "All financial transactions for Q4",
  "objectives": "Verify accuracy of financial records"
}
```

**Update Audit:**
```json
{
  "status": "in_progress",
  "actual_start_date": "2024-10-02",
  "methodology": "Document review and interviews"
}
```

**List Response:**
```json
{
  "audits": [
    {
      "id": 1,
      "name": "Q4 2024 Financial Audit",
      "status": "in_progress",
      "risk_level": "medium",
      "department": "Finance",
      "owner_first_name": "John",
      "owner_last_name": "Doe",
      "planned_start_date": "2024-10-01",
      "planned_end_date": "2024-10-31"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "pages": 1
  }
}
```

## Testing

### Running the Smoke Test

```bash
# Start the backend
cd backend && npm run dev

# In another terminal, run the smoke test
npm run smoke:audit
# Or directly:
node scripts/smoke-test-audit.js
```

### Manual Testing Steps

1. **Login as admin** (admin@example.com / admin123)
2. **Navigate to Audits** in the sidebar
3. **Create a new audit** - verify form layout shows all sections
4. **Change status to "closed"** - verify fields become readonly
5. **Change risk level to "high"** - verify scope/objectives become mandatory
6. **Login as regular user** - verify findings section is hidden
7. **Try to edit another user's audit** - verify ACL blocks unauthorized access

## Database Schema

### Audits Table

```sql
CREATE TABLE audits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  audit_type VARCHAR(50) DEFAULT 'internal',
  status VARCHAR(50) DEFAULT 'planned',
  risk_level VARCHAR(50) DEFAULT 'medium',
  department VARCHAR(100),
  owner_id INTEGER REFERENCES users(id),
  lead_auditor_id INTEGER REFERENCES users(id),
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  scope TEXT,
  objectives TEXT,
  methodology TEXT,
  findings_summary TEXT,
  recommendations TEXT,
  conclusion TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes

- `idx_audits_owner` on `owner_id`
- `idx_audits_lead_auditor` on `lead_auditor_id`
- `idx_audits_status` on `status`
- `idx_audits_risk_level` on `risk_level`
- `idx_audits_department` on `department`
- `idx_audits_audit_type` on `audit_type`

## Migration

Run the Phase 3 migration to set up the Audit module:

```bash
cd backend
npm run migrate:phase3
```

This will:
1. Create the `audits` table
2. Seed audit permissions
3. Seed role permissions for audits
4. Seed ACL rules for audits
5. Seed form layouts for audits
6. Seed UI policies for audits
7. Enable audit module for demo tenants
8. Create sample audit records

## Frontend Components

### AuditList (`/audits`)

- Table view with pagination
- Filter bar with Search DSL integration
- Status, risk level, type, and department filters
- Search text input
- Create/Edit/Delete actions based on ACL

### AuditDetail (`/audits/:id`)

- Form view with sections
- Form Layout integration for role-based field visibility
- UI Policy integration for dynamic field behavior
- ACL-based edit/delete permissions
- Permission display footer

## Best Practices Demonstrated

1. **Configuration-Driven Behavior**: All rules defined as data, not code
2. **Separation of Concerns**: ACL, Form Layout, UI Policy are independent services
3. **Consistent API Design**: RESTful endpoints with standard response formats
4. **Error Handling**: Proper 403 responses for unauthorized access
5. **Caching**: ACL and permission caching for performance
6. **Tenant Awareness**: All operations respect tenant context
