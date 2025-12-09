# ACL (Access Control List) Design Document

## Overview

The ACL Engine provides enterprise-level access control for the GRC Platform, supporting both record-level and field-level permissions. This system enables fine-grained control over who can access, modify, or view specific records and fields.

## Entities

### Permission

Defines individual permission keys that can be assigned to roles.

```sql
CREATE TABLE permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,        -- e.g., 'risk.read', 'policy.write'
  name TEXT NOT NULL,              -- Human-readable name
  description TEXT,                -- Description of what this permission allows
  module TEXT NOT NULL,            -- Module this permission belongs to
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Example Permissions:**
- `risk.read` - View risk records
- `risk.write` - Create/update risk records
- `risk.delete` - Delete risk records
- `policy.publish` - Publish policy documents
- `audit.view` - View audit logs

### Role Permission (M2M)

Links roles to their assigned permissions.

```sql
CREATE TABLE role_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,              -- 'admin', 'manager', 'user'
  permission_key TEXT NOT NULL,    -- References permissions.key
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role, permission_key)
);
```

### ACL Rule

Defines conditional access rules for tables.

```sql
CREATE TABLE acl_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  table_name TEXT NOT NULL,        -- 'risks', 'policies', etc.
  effect TEXT NOT NULL,            -- 'allow' or 'deny'
  conditions TEXT,                 -- JSON conditions
  fields TEXT,                     -- JSON array of field names (for field-level ACL)
  actions TEXT NOT NULL,           -- JSON array: ['read', 'write', 'delete', 'assign']
  priority INTEGER DEFAULT 0,      -- Higher priority rules evaluated first
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Evaluation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ACL Evaluation Request                        │
│              AclService.can(user, action, record)                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    1. Check Admin Role                           │
│              If user.role === 'admin' → ALLOW                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 2. Check Permission Keys                         │
│         hasPermission(user, `${table}.${action}`)                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              3. Evaluate ACL Rules (by priority)                 │
│                                                                  │
│   For each rule matching table_name and action:                  │
│   ├── Evaluate conditions against user and record                │
│   ├── If condition matches:                                      │
│   │   ├── effect === 'deny' → Add to denied fields/DENY          │
│   │   └── effect === 'allow' → Continue to next rule             │
│   └── If no match → Continue to next rule                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    4. Return Result                              │
│   {                                                              │
│     allowed: boolean,                                            │
│     deniedFields: string[],                                      │
│     maskedFields: string[]                                       │
│   }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

## Condition Types

### Owner-Based Condition
```json
{
  "type": "owner",
  "field": "created_by"
}
```
Evaluates to `true` if `record[field] === user.id`

### Role-Based Condition
```json
{
  "type": "role",
  "roles": ["admin", "manager"]
}
```
Evaluates to `true` if `user.role` is in the roles array

### Field-Based Condition
```json
{
  "type": "field",
  "field": "status",
  "operator": "equals",
  "value": "closed"
}
```

Supported operators:
- `equals`, `not_equals`
- `in`, `not_in`
- `greater_than`, `less_than`
- `contains`, `starts_with`, `ends_with`
- `is_null`, `is_not_null`

### Compound Conditions
```json
{
  "and": [
    { "type": "owner", "field": "created_by" },
    { "type": "field", "field": "status", "operator": "equals", "value": "open" }
  ]
}
```

```json
{
  "or": [
    { "type": "role", "roles": ["admin"] },
    { "type": "owner", "field": "created_by" }
  ]
}
```

```json
{
  "not": { "type": "role", "roles": ["user"] }
}
```

## Field-Level ACL

Field-level ACL allows hiding, masking, or making fields read-only based on conditions.

### Example: Hide Confidential Fields
```json
{
  "name": "Hide confidential notes from non-admins",
  "table_name": "risks",
  "effect": "deny",
  "conditions": {
    "not": { "type": "role", "roles": ["admin"] }
  },
  "fields": ["confidential_notes", "internal_assessment"],
  "actions": ["read"]
}
```

### Example: Mask Personal Data
```json
{
  "name": "Mask personal data for standard users",
  "table_name": "users",
  "effect": "deny",
  "conditions": {
    "type": "role",
    "roles": ["user"]
  },
  "fields": ["email", "phone"],
  "actions": ["read"]
}
```

## Integration with Modules

### Risk Module
```javascript
// In risk routes
const aclResult = await AclService.can(req.user, 'read', 'risks', risk);
if (!aclResult.allowed) {
  return res.status(403).json({ message: 'Access denied' });
}

// Filter sensitive fields
const filteredRisk = AclService.filterFields(risk, aclResult.deniedFields);
```

### Policy Module
```javascript
// Check publish permission
const canPublish = await AclService.hasPermission(req.user, 'policy.publish');
if (!canPublish) {
  return res.status(403).json({ message: 'Publish permission required' });
}
```

### Compliance Module
```javascript
// Filter records based on ACL
const requirements = await db.all('SELECT * FROM compliance_requirements');
const filteredRequirements = await AclService.filterRecords(req.user, 'compliance_requirements', requirements);
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/platform/acl/permissions` | Get all permissions |
| GET | `/api/platform/acl/permissions/role/:role` | Get permissions for role |
| POST | `/api/platform/acl/permissions/role/:role` | Assign permission to role |
| DELETE | `/api/platform/acl/permissions/role/:role/:key` | Remove permission from role |
| GET | `/api/platform/acl/rules` | Get all ACL rules |
| GET | `/api/platform/acl/rules/table/:tableName` | Get rules for table |
| POST | `/api/platform/acl/rules` | Create ACL rule |
| PUT | `/api/platform/acl/rules/:id` | Update ACL rule |
| DELETE | `/api/platform/acl/rules/:id` | Delete ACL rule |
| POST | `/api/platform/acl/evaluate` | Evaluate ACL for action |
| GET | `/api/platform/acl/my-permissions` | Get current user's permissions |

## Future Enhancements

1. **Department/BU-Based ACL**: When organizational hierarchy is implemented, add conditions based on user's department or business unit.

2. **Time-Based Rules**: Add support for rules that are only active during specific time periods.

3. **Delegation**: Allow users to delegate their permissions to others temporarily.

4. **Audit Trail**: Log all ACL evaluations for compliance and debugging.

5. **Caching Optimization**: Implement more sophisticated caching strategies for high-traffic scenarios.
