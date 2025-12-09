# Module Visibility and Licensing Design Document

## Overview

The Module Visibility and Licensing Layer enables the GRC Platform to be sold as modular components. Organizations can enable or disable specific modules based on their subscription, allowing for flexible product packaging and licensing.

## Entities

### Tenant Module

Stores module status per tenant.

```sql
CREATE TABLE tenant_modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,         -- Tenant identifier
  module_key TEXT NOT NULL,        -- 'risk', 'policy', 'itsm.incident', etc.
  status TEXT NOT NULL DEFAULT 'disabled',  -- 'enabled' or 'disabled'
  config TEXT,                     -- JSON configuration for the module
  enabled_at DATETIME,
  disabled_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, module_key)
);
```

## Available Modules

### GRC Modules
| Key | Name | Description |
|-----|------|-------------|
| `risk` | Risk Management | Identify, assess, and mitigate organizational risks |
| `policy` | Policy Management | Create, version, and publish organizational policies |
| `compliance` | Compliance Management | Track regulatory requirements and evidence |
| `audit` | Audit Management | Plan and execute internal audits |

### ITSM Modules
| Key | Name | Description |
|-----|------|-------------|
| `itsm.incident` | Incident Management | Track and resolve IT incidents |
| `itsm.cmdb` | Configuration Management | Manage IT assets and configurations |
| `itsm.change` | Change Management | Control IT changes and releases |
| `itsm.problem` | Problem Management | Identify and resolve root causes |
| `itsm.request` | Service Request | Handle service requests and catalog |

### Platform Modules
| Key | Name | Description |
|-----|------|-------------|
| `platform.admin` | Platform Administration | System configuration and user management |
| `platform.reporting` | Reporting & Analytics | Advanced reporting and dashboards |
| `platform.integration` | Integrations | Third-party integrations and APIs |

## Module Categories

```javascript
const moduleCategories = {
  grc: ['risk', 'policy', 'compliance', 'audit'],
  itsm: ['itsm.incident', 'itsm.cmdb', 'itsm.change', 'itsm.problem', 'itsm.request'],
  platform: ['platform.admin', 'platform.reporting', 'platform.integration']
};
```

## Evaluation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Module Check Request                          │
│            ModuleService.isEnabled(tenantId, moduleKey)          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    1. Check Cache                                │
│                                                                  │
│   If cached result exists and not expired:                       │
│   └── Return cached result                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 2. Query Database                                │
│                                                                  │
│   SELECT status FROM tenant_modules                              │
│   WHERE tenant_id = ? AND module_key = ?                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 3. Return Result                                 │
│                                                                  │
│   If record found → Return status === 'enabled'                  │
│   If not found → Return false (module not configured)            │
│                                                                  │
│   Cache result for 60 seconds                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Menu Item Generation

```
┌─────────────────────────────────────────────────────────────────┐
│                    Menu Items Request                            │
│              ModuleService.getMenuItems(tenantId)                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 1. Get Enabled Modules                           │
│                                                                  │
│   SELECT module_key FROM tenant_modules                          │
│   WHERE tenant_id = ? AND status = 'enabled'                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              2. Map Modules to Menu Items                        │
│                                                                  │
│   For each enabled module:                                       │
│   └── Generate menu item with path, icon, label                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 3. Return Menu Items                             │
│                                                                  │
│   [                                                              │
│     { moduleKey: 'risk', path: '/risk', icon: 'Security', ... }, │
│     { moduleKey: 'policy', path: '/governance', icon: '...', ... }│
│   ]                                                              │
└─────────────────────────────────────────────────────────────────┘
```

## Frontend Integration

### ModuleGuard Component

Protects routes and components based on module visibility.

```tsx
import { ModuleGuard } from '../components/ModuleGuard';

// Protect a route
<Route
  path="/risk"
  element={
    <ModuleGuard moduleKey="risk">
      <RiskManagement />
    </ModuleGuard>
  }
/>

// With redirect
<ModuleGuard moduleKey="itsm.incident" redirectTo="/dashboard">
  <IncidentManagement />
</ModuleGuard>

// With custom fallback
<ModuleGuard
  moduleKey="platform.reporting"
  fallback={<UpgradePrompt module="Reporting" />}
>
  <AdvancedReporting />
</ModuleGuard>
```

### RequireModules Component

For components requiring multiple modules.

```tsx
import { RequireModules } from '../components/ModuleGuard';

// Require all modules
<RequireModules modules={['risk', 'compliance']} requireAll>
  <RiskComplianceMatrix />
</RequireModules>

// Require any module
<RequireModules modules={['itsm.incident', 'itsm.problem']}>
  <ITSMDashboard />
</RequireModules>
```

### useModules Hook

```typescript
import { useModules } from '../hooks/useModules';

function Navigation() {
  const { enabledModules, isModuleEnabled, menuItems } = useModules();

  return (
    <nav>
      {menuItems.map(item => (
        <NavLink key={item.moduleKey} to={item.path}>
          <Icon name={item.icon} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

### Layout Integration

The Layout component filters menu items based on enabled modules:

```typescript
const filteredMenuItems = useMemo(() => {
  return menuItems.filter((item) => {
    // Check role restrictions
    if (item.roles && !item.roles.includes(user.role)) {
      return false;
    }
    // Check module visibility
    if (item.moduleKey && !enabledModules.includes(item.moduleKey)) {
      return false;
    }
    return true;
  });
}, [user, enabledModules]);
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/platform/modules/available` | Get all available modules |
| GET | `/api/platform/modules/enabled` | Get enabled modules for tenant |
| GET | `/api/platform/modules/status` | Get all module statuses |
| GET | `/api/platform/modules/check/:moduleKey` | Check if module is enabled |
| GET | `/api/platform/modules/menu` | Get menu items for enabled modules |
| GET | `/api/platform/modules/category/:category` | Get modules by category |
| POST | `/api/platform/modules/:moduleKey/enable` | Enable module |
| POST | `/api/platform/modules/:moduleKey/disable` | Disable module |
| PUT | `/api/platform/modules/:moduleKey/config` | Update module config |
| GET | `/api/platform/modules/:moduleKey/config` | Get module config |
| POST | `/api/platform/modules/initialize` | Initialize modules for new tenant |

## Product Packages

### Starter Package
```javascript
const starterModules = ['risk', 'policy'];
```

### Professional Package
```javascript
const professionalModules = ['risk', 'policy', 'compliance', 'audit'];
```

### Enterprise Package
```javascript
const enterpriseModules = [
  'risk', 'policy', 'compliance', 'audit',
  'itsm.incident', 'itsm.cmdb',
  'platform.admin', 'platform.reporting'
];
```

### Full Suite
```javascript
const fullSuiteModules = [
  'risk', 'policy', 'compliance', 'audit',
  'itsm.incident', 'itsm.cmdb', 'itsm.change', 'itsm.problem', 'itsm.request',
  'platform.admin', 'platform.reporting', 'platform.integration'
];
```

## Tenant Initialization

When a new tenant is created:

```javascript
await ModuleService.initializeTenantModules(tenantId, packageModules);
```

This creates entries in `tenant_modules` for all modules in the package.

## Module Configuration

Modules can have custom configuration stored as JSON:

```json
{
  "risk": {
    "maxRisksPerUser": 100,
    "requireApproval": true,
    "customCategories": ["Security", "Financial", "Operational"]
  },
  "itsm.incident": {
    "slaEnabled": true,
    "defaultPriority": "Medium",
    "autoAssignment": true
  }
}
```

## Caching Strategy

Module status is cached for 60 seconds to reduce database queries:

```javascript
class ModuleService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 60000; // 60 seconds
  }

  clearCache(tenantId) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${tenantId}:`)) {
        this.cache.delete(key);
      }
    }
  }
}
```

## Future Enhancements

1. **License Expiration**: Add expiration dates to module licenses.

2. **Usage Tracking**: Track module usage for billing and analytics.

3. **Feature Flags**: Fine-grained feature toggles within modules.

4. **Trial Periods**: Allow temporary access to modules for evaluation.

5. **Upgrade Prompts**: Smart prompts suggesting module upgrades based on usage.

6. **Module Dependencies**: Define dependencies between modules.

7. **Bulk Operations**: Enable/disable multiple modules at once.

8. **Audit Trail**: Log all module status changes for compliance.
