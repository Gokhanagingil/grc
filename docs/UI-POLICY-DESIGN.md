# UI Policy Engine Design Document

## Overview

The UI Policy Engine provides ServiceNow-like dynamic behavior for forms. It enables no-code conditional rules that can hide/show fields, make fields mandatory, disable editing, and more based on field values or user roles.

## Entities

### UI Policy

Stores conditional UI rules per table.

```sql
CREATE TABLE ui_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  table_name TEXT NOT NULL,        -- 'risks', 'policies', etc.
  condition TEXT NOT NULL,         -- JSON condition
  actions TEXT NOT NULL,           -- JSON array of actions
  priority INTEGER DEFAULT 0,      -- Higher priority evaluated first
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Condition Structure

### Field-Based Condition
```json
{
  "field": "status",
  "operator": "equals",
  "value": "closed"
}
```

### Role-Based Condition
```json
{
  "role": "user"
}
```

Or with multiple roles:
```json
{
  "role": ["user", "manager"]
}
```

### Always True Condition
```json
{
  "always": true
}
```

### Compound Conditions

**AND Condition:**
```json
{
  "and": [
    { "field": "status", "operator": "equals", "value": "closed" },
    { "role": "user" }
  ]
}
```

**OR Condition:**
```json
{
  "or": [
    { "field": "severity", "operator": "equals", "value": "Critical" },
    { "field": "risk_score", "operator": "greater_than", "value": 50 }
  ]
}
```

**NOT Condition:**
```json
{
  "not": { "role": "admin" }
}
```

## Supported Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `equals` | Exact match | `{"field": "status", "operator": "equals", "value": "open"}` |
| `not_equals` | Not equal | `{"field": "status", "operator": "not_equals", "value": "closed"}` |
| `in` | Value in array | `{"field": "severity", "operator": "in", "value": ["High", "Critical"]}` |
| `not_in` | Value not in array | `{"field": "category", "operator": "not_in", "value": ["Archive"]}` |
| `is_empty` | Field is empty/null | `{"field": "notes", "operator": "is_empty"}` |
| `is_not_empty` | Field has value | `{"field": "title", "operator": "is_not_empty"}` |
| `greater_than` | Numeric comparison | `{"field": "risk_score", "operator": "greater_than", "value": 50}` |
| `less_than` | Numeric comparison | `{"field": "risk_score", "operator": "less_than", "value": 20}` |
| `contains` | String contains | `{"field": "title", "operator": "contains", "value": "security"}` |
| `starts_with` | String starts with | `{"field": "title", "operator": "starts_with", "value": "URGENT"}` |
| `ends_with` | String ends with | `{"field": "category", "operator": "ends_with", "value": "_v2"}` |

## Action Types

| Action Type | Description |
|-------------|-------------|
| `hide` | Hide specified fields |
| `show` | Show specified fields (override hide) |
| `readonly` | Make fields read-only |
| `editable` | Make fields editable (override readonly) |
| `mandatory` | Make fields required |
| `optional` | Make fields optional (override mandatory) |
| `disable` | Disable field interaction |

## Action Structure

```json
{
  "type": "hide",
  "fields": ["internal_notes", "confidential_assessment"]
}
```

Multiple actions per policy:
```json
[
  { "type": "readonly", "fields": ["title", "description", "category"] },
  { "type": "hide", "fields": ["mitigation_plan"] },
  { "type": "mandatory", "fields": ["closure_reason"] }
]
```

## Evaluation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    UI Policy Evaluation Request                  │
│      UiPolicyService.getApplicableActions(tableName, formData)   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 1. Fetch Active Policies                         │
│                                                                  │
│   SELECT * FROM ui_policies                                      │
│   WHERE table_name = ? AND is_active = 1                         │
│   ORDER BY priority DESC                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              2. Evaluate Each Policy Condition                   │
│                                                                  │
│   For each policy:                                               │
│   ├── Evaluate condition against formData and context            │
│   ├── If condition is TRUE:                                      │
│   │   └── Collect all actions from this policy                   │
│   └── If condition is FALSE:                                     │
│       └── Skip this policy                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 3. Aggregate Actions                             │
│                                                                  │
│   Combine all applicable actions into:                           │
│   {                                                              │
│     hide: [...],                                                 │
│     show: [...],                                                 │
│     readonly: [...],                                             │
│     editable: [...],                                             │
│     mandatory: [...],                                            │
│     optional: [...],                                             │
│     disable: [...]                                               │
│   }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 4. Return Aggregated Actions                     │
│                                                                  │
│   Frontend applies actions to form renderer                      │
└─────────────────────────────────────────────────────────────────┘
```

## Example Policies

### 1. Disable Editing When Closed
```json
{
  "name": "Disable editing when risk is closed",
  "table_name": "risks",
  "condition": {
    "field": "status",
    "operator": "equals",
    "value": "closed"
  },
  "actions": [
    { "type": "readonly", "fields": ["title", "description", "category", "severity", "likelihood", "impact", "mitigation_plan"] }
  ],
  "priority": 10
}
```

### 2. Require Closure Reason
```json
{
  "name": "Require closure reason when closing",
  "table_name": "risks",
  "condition": {
    "field": "status",
    "operator": "equals",
    "value": "closed"
  },
  "actions": [
    { "type": "mandatory", "fields": ["closure_reason"] },
    { "type": "show", "fields": ["closure_reason", "closed_date"] }
  ],
  "priority": 10
}
```

### 3. Hide Sensitive Fields for Non-Admins
```json
{
  "name": "Hide sensitive fields for non-admin users",
  "table_name": "risks",
  "condition": {
    "not": { "role": "admin" }
  },
  "actions": [
    { "type": "hide", "fields": ["internal_notes", "confidential_assessment"] }
  ],
  "priority": 5
}
```

### 4. Show Mitigation Plan for High Severity
```json
{
  "name": "Require mitigation plan for high severity risks",
  "table_name": "risks",
  "condition": {
    "or": [
      { "field": "severity", "operator": "equals", "value": "High" },
      { "field": "severity", "operator": "equals", "value": "Critical" }
    ]
  },
  "actions": [
    { "type": "mandatory", "fields": ["mitigation_plan"] }
  ],
  "priority": 8
}
```

## Frontend Integration

### useUiPolicy Hook

```typescript
import { useUiPolicy } from '../hooks/useUiPolicy';

function RiskForm({ risk, onChange }) {
  const {
    isFieldHidden,
    isFieldReadonly,
    isFieldMandatory,
    isFieldDisabled,
    evaluatePolicies
  } = useUiPolicy('risks', risk);

  // Re-evaluate when form data changes
  useEffect(() => {
    evaluatePolicies(risk);
  }, [risk.status, risk.severity]);

  return (
    <form>
      {!isFieldHidden('title') && (
        <TextField
          name="title"
          value={risk.title}
          onChange={onChange}
          disabled={isFieldReadonly('title') || isFieldDisabled('title')}
          required={isFieldMandatory('title')}
        />
      )}
      {/* ... more fields */}
    </form>
  );
}
```

### Client-Side Evaluation

For immediate UI updates without server round-trip:

```typescript
import { evaluateCondition } from '../hooks/useUiPolicy';

const condition = { field: 'status', operator: 'equals', value: 'closed' };
const result = evaluateCondition(condition, formData, { user });
// result: true or false
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/platform/ui-policies` | Get all policies |
| GET | `/api/platform/ui-policies/tables` | Get tables with policies |
| GET | `/api/platform/ui-policies/table/:tableName` | Get policies for table |
| GET | `/api/platform/ui-policies/:id` | Get specific policy |
| POST | `/api/platform/ui-policies` | Create policy |
| PUT | `/api/platform/ui-policies/:id` | Update policy |
| DELETE | `/api/platform/ui-policies/:id` | Delete policy |
| POST | `/api/platform/ui-policies/evaluate` | Evaluate policies for form data |
| POST | `/api/platform/ui-policies/test` | Test condition without saving |

## Future Enhancements

1. **Visual Policy Builder**: Drag-and-drop interface for creating policies.

2. **Policy Simulation**: Test policies against sample data before activation.

3. **Cascading Policies**: Policies that trigger other policies.

4. **Field Value Setting**: Actions that set field values automatically.

5. **Validation Rules**: Custom validation messages based on conditions.

6. **Policy Groups**: Group related policies for easier management.

7. **Import/Export**: Export policies as JSON for backup or migration.
