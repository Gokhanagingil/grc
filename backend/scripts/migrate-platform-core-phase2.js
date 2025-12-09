/**
 * Platform Core Phase 2 Migration Script
 * 
 * Creates the following tables:
 * - permissions: Permission definitions (e.g., risk.read, policy.write)
 * - role_permissions: M2M between roles and permissions
 * - acl_rules: Record-level and field-level access control rules
 * - form_layouts: Dynamic form layouts per role
 * - ui_policies: No-code conditional UI rules
 * - tenant_modules: Module visibility and licensing per tenant
 */

const db = require('../db');

const SQLITE_SCHEMA = `
  -- Permissions table
  CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    module TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Role-Permission M2M table
  CREATE TABLE IF NOT EXISTS role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    permission_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE,
    UNIQUE(role, permission_id)
  );

  -- ACL Rules table
  CREATE TABLE IF NOT EXISTS acl_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    table_name TEXT NOT NULL,
    effect TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
    conditions TEXT,
    fields TEXT,
    actions TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Form Layouts table
  CREATE TABLE IF NOT EXISTS form_layouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    role TEXT NOT NULL,
    layout_json TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(table_name, role)
  );

  -- UI Policies table
  CREATE TABLE IF NOT EXISTS ui_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    table_name TEXT NOT NULL,
    condition TEXT NOT NULL,
    actions TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Tenant Modules table
  CREATE TABLE IF NOT EXISTS tenant_modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    module_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
    config TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, module_key)
  );

  -- Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
  CREATE INDEX IF NOT EXISTS idx_acl_rules_table_name ON acl_rules(table_name);
  CREATE INDEX IF NOT EXISTS idx_form_layouts_table_role ON form_layouts(table_name, role);
  CREATE INDEX IF NOT EXISTS idx_ui_policies_table_name ON ui_policies(table_name);
  CREATE INDEX IF NOT EXISTS idx_tenant_modules_tenant ON tenant_modules(tenant_id);
`;

const PG_SCHEMA = `
  -- Permissions table
  CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    module VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Role-Permission M2M table
  CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role VARCHAR(50) NOT NULL,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role, permission_id)
  );

  -- ACL Rules table
  CREATE TABLE IF NOT EXISTS acl_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    effect VARCHAR(10) NOT NULL CHECK (effect IN ('allow', 'deny')),
    conditions JSONB,
    fields JSONB,
    actions VARCHAR(255) NOT NULL,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Form Layouts table
  CREATE TABLE IF NOT EXISTS form_layouts (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    layout_json JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(table_name, role)
  );

  -- UI Policies table
  CREATE TABLE IF NOT EXISTS ui_policies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    condition JSONB NOT NULL,
    actions JSONB NOT NULL,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Tenant Modules table
  CREATE TABLE IF NOT EXISTS tenant_modules (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    module_key VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
    config JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, module_key)
  );

  -- Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
  CREATE INDEX IF NOT EXISTS idx_acl_rules_table_name ON acl_rules(table_name);
  CREATE INDEX IF NOT EXISTS idx_form_layouts_table_role ON form_layouts(table_name, role);
  CREATE INDEX IF NOT EXISTS idx_ui_policies_table_name ON ui_policies(table_name);
  CREATE INDEX IF NOT EXISTS idx_tenant_modules_tenant ON tenant_modules(tenant_id);
`;

const DEFAULT_PERMISSIONS = [
  { key: 'risk.read', name: 'Read Risks', description: 'View risk records', module: 'risk' },
  { key: 'risk.write', name: 'Write Risks', description: 'Create and update risk records', module: 'risk' },
  { key: 'risk.delete', name: 'Delete Risks', description: 'Delete risk records', module: 'risk' },
  { key: 'risk.assign', name: 'Assign Risks', description: 'Assign risks to users', module: 'risk' },
  { key: 'policy.read', name: 'Read Policies', description: 'View policy records', module: 'policy' },
  { key: 'policy.write', name: 'Write Policies', description: 'Create and update policy records', module: 'policy' },
  { key: 'policy.delete', name: 'Delete Policies', description: 'Delete policy records', module: 'policy' },
  { key: 'policy.publish', name: 'Publish Policies', description: 'Publish policy records', module: 'policy' },
  { key: 'compliance.read', name: 'Read Compliance', description: 'View compliance requirements', module: 'compliance' },
  { key: 'compliance.write', name: 'Write Compliance', description: 'Create and update compliance requirements', module: 'compliance' },
  { key: 'compliance.delete', name: 'Delete Compliance', description: 'Delete compliance requirements', module: 'compliance' },
  { key: 'audit.view', name: 'View Audit Logs', description: 'View audit log entries', module: 'audit' },
  { key: 'user.read', name: 'Read Users', description: 'View user records', module: 'user' },
  { key: 'user.write', name: 'Write Users', description: 'Create and update user records', module: 'user' },
  { key: 'user.delete', name: 'Delete Users', description: 'Delete user records', module: 'user' },
  { key: 'admin.access', name: 'Admin Access', description: 'Access admin panel', module: 'admin' }
];

const DEFAULT_ROLE_PERMISSIONS = {
  admin: [
    'risk.read', 'risk.write', 'risk.delete', 'risk.assign',
    'policy.read', 'policy.write', 'policy.delete', 'policy.publish',
    'compliance.read', 'compliance.write', 'compliance.delete',
    'audit.view', 'user.read', 'user.write', 'user.delete', 'admin.access'
  ],
  manager: [
    'risk.read', 'risk.write', 'risk.assign',
    'policy.read', 'policy.write', 'policy.publish',
    'compliance.read', 'compliance.write',
    'audit.view', 'user.read'
  ],
  user: [
    'risk.read', 'policy.read', 'compliance.read'
  ]
};

const DEFAULT_ACL_RULES = [
  {
    name: 'Owner can edit own records',
    table_name: 'risks',
    effect: 'allow',
    conditions: JSON.stringify({ owner_id: '{{user.id}}' }),
    fields: null,
    actions: 'read,write',
    priority: 10
  },
  {
    name: 'Owner can edit own policies',
    table_name: 'policies',
    effect: 'allow',
    conditions: JSON.stringify({ owner_id: '{{user.id}}' }),
    fields: null,
    actions: 'read,write',
    priority: 10
  },
  {
    name: 'Hide confidential fields from standard users',
    table_name: 'risks',
    effect: 'deny',
    conditions: JSON.stringify({ role: 'user' }),
    fields: JSON.stringify(['mitigation_plan', 'internal_notes']),
    actions: 'read',
    priority: 5
  },
  {
    name: 'Mask personal data for non-admins',
    table_name: 'users',
    effect: 'deny',
    conditions: JSON.stringify({ role: ['user', 'manager'] }),
    fields: JSON.stringify(['email', 'phone']),
    actions: 'read',
    priority: 5
  }
];

const DEFAULT_FORM_LAYOUTS = [
  {
    table_name: 'risks',
    role: 'user',
    layout_json: JSON.stringify({
      sections: [
        {
          title: 'Basic Information',
          fields: ['title', 'description', 'category', 'status']
        },
        {
          title: 'Risk Assessment',
          fields: ['severity', 'likelihood', 'impact', 'risk_score']
        }
      ],
      hiddenFields: ['mitigation_plan', 'internal_notes', 'owner_id'],
      readonlyFields: ['risk_score', 'created_at', 'updated_at']
    })
  },
  {
    table_name: 'risks',
    role: 'manager',
    layout_json: JSON.stringify({
      sections: [
        {
          title: 'Basic Information',
          fields: ['title', 'description', 'category', 'status']
        },
        {
          title: 'Risk Assessment',
          fields: ['severity', 'likelihood', 'impact', 'risk_score']
        },
        {
          title: 'Mitigation',
          fields: ['mitigation_plan', 'assigned_to', 'due_date']
        }
      ],
      hiddenFields: ['internal_notes'],
      readonlyFields: ['risk_score', 'created_at', 'updated_at', 'owner_id']
    })
  },
  {
    table_name: 'policies',
    role: 'user',
    layout_json: JSON.stringify({
      sections: [
        {
          title: 'Policy Details',
          fields: ['title', 'description', 'category', 'version', 'status']
        },
        {
          title: 'Content',
          fields: ['content']
        }
      ],
      hiddenFields: ['owner_id'],
      readonlyFields: ['version', 'status', 'effective_date', 'review_date', 'created_at', 'updated_at']
    })
  }
];

const DEFAULT_UI_POLICIES = [
  {
    name: 'Hide mitigation when status is closed',
    table_name: 'risks',
    condition: JSON.stringify({ field: 'status', operator: 'equals', value: 'closed' }),
    actions: JSON.stringify([{ type: 'hide', fields: ['mitigation_plan', 'assigned_to'] }]),
    priority: 10
  },
  {
    name: 'Make fields readonly when status is closed',
    table_name: 'risks',
    condition: JSON.stringify({ field: 'status', operator: 'equals', value: 'closed' }),
    actions: JSON.stringify([{ type: 'readonly', fields: ['title', 'description', 'severity', 'likelihood', 'impact'] }]),
    priority: 10
  },
  {
    name: 'Make title mandatory',
    table_name: 'risks',
    condition: JSON.stringify({ always: true }),
    actions: JSON.stringify([{ type: 'mandatory', fields: ['title'] }]),
    priority: 1
  },
  {
    name: 'Disable editing published policies',
    table_name: 'policies',
    condition: JSON.stringify({ field: 'status', operator: 'equals', value: 'published' }),
    actions: JSON.stringify([{ type: 'readonly', fields: ['title', 'description', 'content', 'category'] }]),
    priority: 10
  }
];

const DEFAULT_TENANT_MODULES = [
  { tenant_id: 'default', module_key: 'risk', status: 'enabled' },
  { tenant_id: 'default', module_key: 'policy', status: 'enabled' },
  { tenant_id: 'default', module_key: 'compliance', status: 'enabled' },
  { tenant_id: 'default', module_key: 'audit', status: 'enabled' },
  { tenant_id: 'default', module_key: 'itsm.incident', status: 'enabled' },
  { tenant_id: 'default', module_key: 'itsm.cmdb', status: 'disabled' }
];

async function runMigration() {
  console.log('Starting Platform Core Phase 2 migration...');
  
  try {
    await db.init();
    
    const schema = db.isPostgres() ? PG_SCHEMA : SQLITE_SCHEMA;
    const statements = schema.split(';').filter(s => s.trim());
    
    console.log('Creating tables...');
    for (const stmt of statements) {
      if (stmt.trim()) {
        await db.run(stmt);
      }
    }
    console.log('Tables created successfully.');
    
    console.log('Seeding default permissions...');
    for (const perm of DEFAULT_PERMISSIONS) {
      const placeholder = db.isPostgres() ? '$1' : '?';
      const existing = await db.get(
        `SELECT id FROM permissions WHERE key = ${placeholder}`,
        [perm.key]
      );
      if (!existing) {
        if (db.isPostgres()) {
          await db.run(
            `INSERT INTO permissions (key, name, description, module) VALUES ($1, $2, $3, $4)`,
            [perm.key, perm.name, perm.description, perm.module]
          );
        } else {
          await db.run(
            `INSERT INTO permissions (key, name, description, module) VALUES (?, ?, ?, ?)`,
            [perm.key, perm.name, perm.description, perm.module]
          );
        }
      }
    }
    console.log('Permissions seeded.');
    
    console.log('Seeding role permissions...');
    for (const [role, permKeys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const permKey of permKeys) {
        const placeholder = db.isPostgres() ? '$1' : '?';
        const perm = await db.get(
          `SELECT id FROM permissions WHERE key = ${placeholder}`,
          [permKey]
        );
        if (perm) {
          const placeholder2 = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
          const existing = await db.get(
            `SELECT id FROM role_permissions WHERE role = ${placeholder2[0]} AND permission_id = ${placeholder2[1]}`,
            [role, perm.id]
          );
          if (!existing) {
            if (db.isPostgres()) {
              await db.run(
                `INSERT INTO role_permissions (role, permission_id) VALUES ($1, $2)`,
                [role, perm.id]
              );
            } else {
              await db.run(
                `INSERT INTO role_permissions (role, permission_id) VALUES (?, ?)`,
                [role, perm.id]
              );
            }
          }
        }
      }
    }
    console.log('Role permissions seeded.');
    
    console.log('Seeding ACL rules...');
    for (const rule of DEFAULT_ACL_RULES) {
      const placeholder = db.isPostgres() ? '$1' : '?';
      const existing = await db.get(
        `SELECT id FROM acl_rules WHERE name = ${placeholder}`,
        [rule.name]
      );
      if (!existing) {
        if (db.isPostgres()) {
          await db.run(
            `INSERT INTO acl_rules (name, table_name, effect, conditions, fields, actions, priority) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [rule.name, rule.table_name, rule.effect, rule.conditions, rule.fields, rule.actions, rule.priority]
          );
        } else {
          await db.run(
            `INSERT INTO acl_rules (name, table_name, effect, conditions, fields, actions, priority) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [rule.name, rule.table_name, rule.effect, rule.conditions, rule.fields, rule.actions, rule.priority]
          );
        }
      }
    }
    console.log('ACL rules seeded.');
    
    console.log('Seeding form layouts...');
    for (const layout of DEFAULT_FORM_LAYOUTS) {
      const placeholder = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
      const existing = await db.get(
        `SELECT id FROM form_layouts WHERE table_name = ${placeholder[0]} AND role = ${placeholder[1]}`,
        [layout.table_name, layout.role]
      );
      if (!existing) {
        if (db.isPostgres()) {
          await db.run(
            `INSERT INTO form_layouts (table_name, role, layout_json) VALUES ($1, $2, $3)`,
            [layout.table_name, layout.role, layout.layout_json]
          );
        } else {
          await db.run(
            `INSERT INTO form_layouts (table_name, role, layout_json) VALUES (?, ?, ?)`,
            [layout.table_name, layout.role, layout.layout_json]
          );
        }
      }
    }
    console.log('Form layouts seeded.');
    
    console.log('Seeding UI policies...');
    for (const policy of DEFAULT_UI_POLICIES) {
      const placeholder = db.isPostgres() ? '$1' : '?';
      const existing = await db.get(
        `SELECT id FROM ui_policies WHERE name = ${placeholder}`,
        [policy.name]
      );
      if (!existing) {
        if (db.isPostgres()) {
          await db.run(
            `INSERT INTO ui_policies (name, table_name, condition, actions, priority) VALUES ($1, $2, $3, $4, $5)`,
            [policy.name, policy.table_name, policy.condition, policy.actions, policy.priority]
          );
        } else {
          await db.run(
            `INSERT INTO ui_policies (name, table_name, condition, actions, priority) VALUES (?, ?, ?, ?, ?)`,
            [policy.name, policy.table_name, policy.condition, policy.actions, policy.priority]
          );
        }
      }
    }
    console.log('UI policies seeded.');
    
    console.log('Seeding tenant modules...');
    for (const mod of DEFAULT_TENANT_MODULES) {
      const placeholder = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
      const existing = await db.get(
        `SELECT id FROM tenant_modules WHERE tenant_id = ${placeholder[0]} AND module_key = ${placeholder[1]}`,
        [mod.tenant_id, mod.module_key]
      );
      if (!existing) {
        if (db.isPostgres()) {
          await db.run(
            `INSERT INTO tenant_modules (tenant_id, module_key, status) VALUES ($1, $2, $3)`,
            [mod.tenant_id, mod.module_key, mod.status]
          );
        } else {
          await db.run(
            `INSERT INTO tenant_modules (tenant_id, module_key, status) VALUES (?, ?, ?)`,
            [mod.tenant_id, mod.module_key, mod.status]
          );
        }
      }
    }
    console.log('Tenant modules seeded.');
    
    console.log('Platform Core Phase 2 migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
